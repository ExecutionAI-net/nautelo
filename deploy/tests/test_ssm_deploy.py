import base64
import gzip
import importlib.util
import json
from pathlib import Path
import shlex
import subprocess
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location('ssm_deploy', Path(__file__).parents[1] / 'ssm_deploy.py')
ssm = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(ssm)


class SSMDeploymentTests(unittest.TestCase):
    def test_bundle_contains_only_deployment_files_and_public_config(self):
        body = ssm.request('dev', 'dev-abc123', 'i-0123456789abcdef0', {
            'region': 'eu-west-1', 'registry': 'example', 'secret_id': 'nautelo/dev',
            'DO_NOT_TRANSFER': 'private-value',
        })
        args = shlex.split(body['Parameters']['commands'][-1])
        self.assertEqual(args[:2], ['python3', '-c'])
        data = json.loads(gzip.decompress(base64.b64decode(args[-1])))
        self.assertEqual(set(data['files']), {'manage.py', 'docker-compose.dev.yml', 'config.dev.json'})
        self.assertNotIn('private-value', json.dumps(data))
        self.assertEqual(body['InstanceIds'], ['i-0123456789abcdef0'])
        self.assertEqual(body['Parameters']['executionTimeout'], ['1800'])

    def test_rejects_cross_environment_tags_and_command_injection(self):
        for env, tag, instance in [('prod', 'dev-abc', 'i-0123456789abcdef0'),
                                   ('dev', 'dev-abc;id', 'i-0123456789abcdef0'),
                                   ('dev', 'dev-abc', 'i-0123456789abcdef0;id')]:
            with self.subTest(tag=tag, instance=instance), self.assertRaises(ValueError):
                ssm.request(env, tag, instance, {})

    @patch.object(ssm.time, 'sleep')
    @patch.object(ssm.subprocess, 'run')
    def test_poll_handles_eventual_consistency_then_success(self, run, sleep):
        run.side_effect = [subprocess.CompletedProcess([], 1, '', 'InvocationDoesNotExist'),
                           subprocess.CompletedProcess([], 0, '{"Status":"InProgress"}'),
                           subprocess.CompletedProcess([], 0, '{"Status":"Success"}')]
        ssm.wait_for_command('eu-west-1', 'i-test', 'cmd')
        self.assertEqual(sleep.call_count, 2)

    @patch.object(ssm.subprocess, 'run')
    def test_failure_fails_workflow_without_echoing_remote_output(self, run):
        run.return_value = subprocess.CompletedProcess([], 0, json.dumps({
            'Status': 'Failed', 'StandardErrorContent': 'sensitive output'}))
        with self.assertRaisesRegex(RuntimeError, 'ended with Failed') as error:
            ssm.wait_for_command('eu-west-1', 'i-test', 'cmd')
        self.assertNotIn('sensitive output', str(error.exception))

    @patch.object(ssm.time, 'monotonic', side_effect=[0, 2500])
    def test_timeout_does_not_claim_success(self, clock):
        with self.assertRaisesRegex(RuntimeError, 'may still be running'):
            ssm.wait_for_command('eu-west-1', 'i-test', 'cmd')


if __name__ == '__main__':
    unittest.main()
