#!/usr/bin/env python3
"""Validate and install the shared Cloudflare origin proxy on EC2."""
import argparse
import fcntl
from pathlib import Path
import shutil
import subprocess
import tempfile

SOURCE = Path(__file__).resolve().parent
DESTINATION = Path('/opt/nautelo/proxy')
CERT_DIRECTORY = Path('/etc/nautelo/tls')
FILES = ('docker-compose.proxy.yml', 'nginx.conf', 'cloudflare-realip.conf')
DOMAINS = ('dev.nautelo.com', 'nautelo.com', 'www.nautelo.com')


def run(command, **kwargs):
    return subprocess.run(command, check=True, **kwargs)


def check_certificate(directory=CERT_DIRECTORY):
    cert, key = directory / 'origin.pem', directory / 'origin.key'
    for path in (cert, key):
        if not path.is_file() or path.stat().st_size == 0:
            raise ValueError(f'Upload the Cloudflare Origin certificate/key first: missing {path}')
    if key.stat().st_mode & 0o077:
        raise ValueError(f'Private key permissions must be 0600: chmod 600 {key}')
    run(['openssl', 'x509', '-in', str(cert), '-checkend', '86400', '-noout'], capture_output=True)
    for domain in DOMAINS:
        result = run(['openssl', 'x509', '-in', str(cert), '-checkhost', domain, '-noout'], capture_output=True, text=True)
        # openssl x509 -checkhost can exit 0 even for a mismatch. Inspect its verdict.
        if f'Hostname {domain} does match certificate' not in result.stdout:
            raise ValueError(f'Origin certificate does not cover {domain}')
    certificate_public_key = run(['openssl', 'x509', '-in', str(cert), '-pubkey', '-noout'], capture_output=True).stdout
    private_public_key = run(['openssl', 'pkey', '-in', str(key), '-passin', 'pass:', '-pubout'], capture_output=True).stdout
    if certificate_public_key != private_public_key:
        raise ValueError('Cloudflare Origin certificate and private key do not match')


def apply():
    DESTINATION.mkdir(parents=True, exist_ok=True, mode=0o700)
    # Dev and prod share ports and proxy files, so serialize updates across branches.
    with (DESTINATION / '.lock').open('w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        check_certificate()
        for environment in ('dev', 'prod'):
            network = f'nautelo-{environment}-edge'
            if subprocess.run(['docker', 'network', 'inspect', network], stdout=subprocess.DEVNULL,
                              stderr=subprocess.DEVNULL).returncode:
                run(['docker', 'network', 'create', network])
            run(['docker', 'volume', 'create', f'nautelo-{environment}-static'], stdout=subprocess.DEVNULL)
        # Test a candidate using real certificates without binding ports or stopping the old proxy.
        with tempfile.TemporaryDirectory(prefix='candidate-', dir=DESTINATION) as tmp:
            candidate = Path(tmp)
            for name in FILES:
                shutil.copyfile(SOURCE / name, candidate / name)
            validation = ['docker', 'compose', '-f', str(candidate / FILES[0])]
            run(validation + ['config', '--quiet'])
            run(validation + ['pull', '--quiet'])
            run(validation + ['run', '--rm', '--no-deps', 'nginx', 'nginx', '-t'])
        changed = any(not (DESTINATION / name).exists() or
                      (DESTINATION / name).read_bytes() != (SOURCE / name).read_bytes() for name in FILES)
        for name in FILES:
            shutil.copyfile(SOURCE / name, DESTINATION / name)
        # Switch off only the temporary IP-test proxy. Never delete app containers or volumes.
        old = run(['docker', 'ps', '-q', '--filter',
                   'label=com.docker.compose.project=nautelo-dev-http-proxy'], capture_output=True, text=True).stdout.split()
        if old:
            run(['docker', 'stop', *old])
        compose = ['docker', 'compose', '-f', str(DESTINATION / FILES[0])]
        command = compose + ['up', '-d', '--wait', '--wait-timeout', '90']
        if changed:
            command.append('--force-recreate')
        run(command)
        # Reload also picks up certificate rotation from the directory bind mount.
        run(compose + ['exec', '-T', 'nginx', 'nginx', '-s', 'reload'])


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=('check', 'apply'))
    args = parser.parse_args()
    try:
        if args.action == 'check':
            check_certificate()
        else:
            apply()
    except subprocess.CalledProcessError as exc:
        raise SystemExit(f'Origin proxy check/update failed (exit {exc.returncode}); verify certificate dates, hostnames, key, and Nginx output') from None
    except (OSError, ValueError) as exc:
        raise SystemExit(str(exc)) from None
