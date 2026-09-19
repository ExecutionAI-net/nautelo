import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location('manage', Path(__file__).parents[1] / 'manage.py')
manage = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(manage)


class DeploymentConfigurationTests(unittest.TestCase):
    def setUp(self):
        self.secret = json.loads((Path(__file__).parents[1] / 'secret.example.json').read_text())

    def test_service_credentials_are_scoped_and_database_password_is_encoded(self):
        self.secret['POSTGRES_PASSWORD'] = 'p@ss:/?#$\'"= word'
        result = manage.environments(self.secret, 'eu-west-1')
        self.assertEqual(result['postgres']['POSTGRES_PASSWORD'], self.secret['POSTGRES_PASSWORD'])
        self.assertNotIn('POSTGRES_PASSWORD', result['backend'])
        self.assertNotIn('STRIPE_SECRET_KEY', result['frontend'])
        self.assertEqual(set(result['frontend']), {'NEXT_PUBLIC_BASE_URL', 'NEXT_PUBLIC_API_BASE_URL', 'INTERNAL_SERVICE_SECRET'})
        self.assertIn('p%40ss%3A%2F%3F%23%24%27%22%3D%20word@postgres', result['backend']['DATABASE_URL'])
        self.assertEqual(result['backend']['DJANGO_ALLOWED_HOSTS'], 'api.dev.example.com')
        self.assertEqual(result['backend']['DJANGO_SETTINGS_MODULE'], 'config.settings.prod')

    def test_deployment_always_serves_private_s3_directly(self):
        self.secret['MEDIA_PUBLIC_BASE_URL'] = 'https://old-cdn.example.com'
        backend = manage.environments(self.secret, 'eu-west-1')['backend']
        self.assertEqual(backend['MEDIA_PUBLIC_BASE_URL'], '')
        self.assertEqual(backend['MEDIA_SIGNED_URLS'], 'True')

    def test_raw_file_preserves_special_characters_and_is_private(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'backend.env'
            manage.write_env(path, {'SECRET': ' a$#\'"=z '})
            self.assertEqual(path.read_text(), 'SECRET= a$#\'"=z \n')
            self.assertEqual(path.stat().st_mode & 0o777, 0o600)

    def test_rejects_missing_values_newlines_and_static_credentials(self):
        for key, value in [('DJANGO_SECRET_KEY', ''), ('BAD', 'x\nINJECTED=yes'),
                           ('BAD', 'x\r'), ('BAD', 123), ('AWS_ACCESS_KEY_ID', 'key'),
                           ('OBJECT_STORAGE_ENDPOINT_URL', 'http://minio')]:
            with self.subTest(key=key, value=value), self.assertRaises(ValueError):
                manage.environments(dict(self.secret, **{key: value}), 'eu-west-1')

    def test_rejects_non_origin_public_urls(self):
        for url in ['http://example.com', 'https://example.com/path', 'https://user@example.com',
                    'https://example.com?q=1', 'https://example.com:443']:
            with self.subTest(url=url), self.assertRaises(ValueError):
                manage.origin(url)

    def test_deploy_stops_if_migration_fails(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / 'deploy').mkdir()
            (root / 'deploy/config.dev.json').write_text(json.dumps({
                'region': 'eu-west-1', 'registry': '123456789012.dkr.ecr.eu-west-1.amazonaws.com', 'secret_id': 'nautelo/dev'}))
            commands = []
            def fake_run(command, **kwargs):
                commands.append(command)
                if 'get-secret-value' in command:
                    return manage.subprocess.CompletedProcess(command, 0, stdout=json.dumps(json.dumps(self.secret)))
                if 'get-login-password' in command:
                    return manage.subprocess.CompletedProcess(command, 0, stdout=b'password')
                if 'run' in command and 'migrate' in command:
                    raise manage.subprocess.CalledProcessError(1, command)
                return manage.subprocess.CompletedProcess(command, 0)
            with patch.object(manage, 'ROOT', root), patch.object(manage, 'run', side_effect=fake_run), \
                 patch.object(manage.subprocess, 'run', return_value=manage.subprocess.CompletedProcess([], 0)), \
                 patch('sys.argv', ['manage.py', 'deploy', 'dev', 'dev-abc123']):
                with self.assertRaises(manage.subprocess.CalledProcessError):
                    manage.main()
            self.assertFalse(any('--force-recreate' in cmd for cmd in commands))


if __name__ == '__main__':
    unittest.main()
