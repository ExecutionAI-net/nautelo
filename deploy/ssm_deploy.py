#!/usr/bin/env python3
"""Send a self-contained, secret-free release to EC2 through SSM and await its result."""
import argparse
import base64
import gzip
import json
from pathlib import Path
import re
import shlex
import subprocess
import tempfile
import time

ROOT = Path(__file__).resolve().parent


def request(environment, tag, instance_id, config):
    if environment not in ('dev', 'prod') or not re.fullmatch(r'[1-9][0-9]{0,19}', tag):
        raise ValueError('Invalid environment/tag')
    if not re.fullmatch(r'i-[a-f0-9]{8,17}', instance_id):
        raise ValueError('Set EC2_INSTANCE_ID to the target EC2 instance ID')
    # Explicit allowlist: never send .env files or Secrets Manager contents to SSM.
    public_config = {key: config[key] for key in ('region', 'registry', 'secret_id')}
    files = {name: (ROOT / name).read_text() for name in ('manage.py', f'docker-compose.{environment}.yml')}
    if environment == 'dev':
        for name in ('docker-compose.proxy.dev-http.yml', 'nginx.dev-http.conf'):
            files[name] = (ROOT / name).read_text()
    files[f'config.{environment}.json'] = json.dumps(public_config)
    payload = base64.b64encode(gzip.compress(json.dumps({
        'environment': environment, 'tag': tag, 'files': files,
    }).encode())).decode()
    command = shlex.join(['python3', '-c', (ROOT / 'ssm_remote.py').read_text(), payload])
    if len(command.encode()) > 24000:
        raise ValueError('Deployment bundle exceeds inline SSM command size budget')
    return {'InstanceIds': [instance_id], 'DocumentName': 'AWS-RunShellScript',
            'Comment': f'Nautelo {environment} {tag}'[:100], 'TimeoutSeconds': 600,
            'Parameters': {'commands': ['set -eu', 'umask 077', command], 'executionTimeout': ['1800']}}


def wait_for_command(region, instance_id, command_id, timeout=2400):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        result = subprocess.run(['aws', 'ssm', 'get-command-invocation', '--region', region,
                                 '--instance-id', instance_id, '--command-id', command_id, '--output', 'json'],
                                capture_output=True, text=True)
        if result.returncode:
            if 'InvocationDoesNotExist' not in result.stderr:
                raise RuntimeError(f'Unable to read SSM command {command_id}; inspect it in Systems Manager')
        else:
            invocation = json.loads(result.stdout)
            status = invocation['Status']
            if status == 'Success':
                return
            if status not in ('Pending', 'InProgress', 'Delayed', 'Cancelling'):
                # Surface the tail of the remote output so a failed deploy is diagnosable from the CI log.
                for stream in ('StandardErrorContent', 'StandardOutputContent'):
                    tail = (invocation.get(stream) or '')[-2500:]
                    if tail.strip():
                        print(f'--- {stream} (tail) ---', flush=True)
                        print(tail, flush=True)
                raise RuntimeError(f'SSM deployment {command_id} ended with {status}; inspect Systems Manager output')
        time.sleep(10)
    raise RuntimeError(f'Timed out waiting for SSM command {command_id}; it may still be running. Inspect before retrying')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('environment', choices=('dev', 'prod'))
    parser.add_argument('tag')
    parser.add_argument('--instance-id', required=True)
    args = parser.parse_args()
    config = json.loads((ROOT / f'config.{args.environment}.json').read_text())
    body = request(args.environment, args.tag, args.instance_id, config)
    with tempfile.NamedTemporaryFile(mode='w', suffix='.json') as handle:
        json.dump(body, handle)
        handle.flush()
        result = subprocess.run(['aws', 'ssm', 'send-command', '--region', config['region'],
                                 '--cli-input-json', f'file://{handle.name}', '--output', 'json'],
                                check=True, capture_output=True, text=True)
    command_id = json.loads(result.stdout)['Command']['CommandId']
    print(f'SSM command: {command_id}', flush=True)
    wait_for_command(config['region'], args.instance_id, command_id)
    print(f'Deployed {args.environment} {args.tag} successfully', flush=True)


if __name__ == '__main__':
    main()
