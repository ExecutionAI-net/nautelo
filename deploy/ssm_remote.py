"""Executed by SSM as root. Installs only the deployment files for this release."""
import base64
import fcntl
import gzip
import json
from pathlib import Path
import re
import subprocess
import sys


def main(payload):
    data = json.loads(gzip.decompress(base64.b64decode(payload)))
    environment, tag = data['environment'], data['tag']
    if environment not in ('dev', 'prod') or not re.fullmatch(r'[1-9][0-9]{0,19}', tag):
        raise ValueError('Invalid release')
    base = Path('/opt/nautelo')
    runtime = base / 'deploy/runtime'
    state = runtime / environment
    state.mkdir(parents=True, exist_ok=True, mode=0o700)
    state.chmod(0o700)
    with (state / '.ssm-lock').open('w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        release = base / 'releases' / environment / tag
        deploy = release / 'deploy'
        deploy.mkdir(parents=True, exist_ok=True)
        expected = {'manage.py', f'docker-compose.{environment}.yml', f'config.{environment}.json'}
        expected.update({'proxy.py', 'docker-compose.proxy.yml', 'nginx.conf', 'cloudflare-realip.conf'})
        if environment == 'dev':
            expected.update({'docker-compose.proxy.dev-http.yml', 'nginx.dev-http.conf'})
        if set(data['files']) != expected:
            raise ValueError('Unexpected release files')
        for name, content in data['files'].items():
            (deploy / name).write_text(content)
        link = deploy / 'runtime'
        if not link.exists():
            link.symlink_to(runtime, target_is_directory=True)
        subprocess.run(['python3', str(deploy / 'manage.py'), 'deploy', environment, tag], check=True)
        (state / 'last-successful-release').write_text(str(release) + '\n')


if __name__ == '__main__':
    main(sys.argv[1])
