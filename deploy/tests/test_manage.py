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
        self.secret.update(NEXT_PUBLIC_BASE_URL='https://dev.example.com', NEXT_PUBLIC_API_BASE_URL='https://api.dev.example.com')
        # The runner's real disk is irrelevant to these flow tests; the check has its own tests below.
        patcher = patch.object(manage, 'ensure_free_space')
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_secrets_access_error_identifies_operation_without_leaking_output(self):
        error = manage.subprocess.CalledProcessError(254, ['aws', 'secretsmanager', 'get-secret-value'],
            output='SECRET_PAYLOAD', stderr='An error occurred (AccessDeniedException) when calling the GetSecretValue operation: PRIVATE_DETAILS')
        message = manage.command_failure(error)
        self.assertIn('Secrets Manager GetSecretValue', message)
        self.assertIn('AccessDeniedException', message)
        self.assertIn('secretsmanager:GetSecretValue', message)
        self.assertNotIn('SECRET_PAYLOAD', message)
        self.assertNotIn('PRIVATE_DETAILS', message)

    def test_ecr_access_error_handles_byte_stderr_without_printing_login_token(self):
        error = manage.subprocess.CalledProcessError(254, ['aws', 'ecr', 'get-login-password'],
            output=b'ECR_LOGIN_TOKEN', stderr=b'An error occurred (AccessDeniedException) when calling the GetAuthorizationToken operation: PRIVATE_DETAILS')
        message = manage.command_failure(error)
        self.assertIn('ecr:GetAuthorizationToken', message)
        self.assertNotIn('ECR_LOGIN_TOKEN', message)
        self.assertNotIn('PRIVATE_DETAILS', message)

    def test_unknown_error_and_command_arguments_are_not_echoed(self):
        error = manage.subprocess.CalledProcessError(254, ['aws', 'secretsmanager', 'get-secret-value'],
            stderr='An error occurred (PRIVATEVALUE) when calling a request: SECRET')
        message = manage.command_failure(error)
        self.assertIn('UnclassifiedAwsError', message)
        self.assertNotIn('PRIVATEVALUE', message)
        error = manage.subprocess.CalledProcessError(1, ['docker', 'build', '--build-arg', 'PRIVATEVALUE'])
        self.assertNotIn('PRIVATEVALUE', manage.command_failure(error))

    def test_missing_secret_reports_account_region_and_identifier_checks(self):
        error = manage.subprocess.CalledProcessError(254, ['aws', 'secretsmanager', 'get-secret-value'],
            stderr='An error occurred (ResourceNotFoundException) when calling the GetSecretValue operation: missing')
        message = manage.command_failure(error)
        self.assertIn('AWS_SECRET_ID', message)
        self.assertIn('account', message)

    def test_service_credentials_are_scoped_and_database_password_is_encoded(self):
        self.secret['POSTGRES_PASSWORD'] = 'p@ss:/?#$\'"= word'
        result = manage.environments(self.secret, 'eu-west-1')
        self.assertEqual(result['postgres']['POSTGRES_PASSWORD'], self.secret['POSTGRES_PASSWORD'])
        self.assertNotIn('POSTGRES_PASSWORD', result['backend'])
        self.assertNotIn('STRIPE_SECRET_KEY', result['frontend'])
        self.assertEqual(result['frontend']['INTERNAL_API_BASE_URL'], 'http://api:8000')
        self.assertEqual(set(result['frontend']), {'NEXT_PUBLIC_BASE_URL', 'NEXT_PUBLIC_API_BASE_URL', 'INTERNAL_SERVICE_SECRET', 'INTERNAL_API_BASE_URL'})
        self.assertIn('p%40ss%3A%2F%3F%23%24%27%22%3D%20word@postgres', result['backend']['DATABASE_URL'])
        self.assertEqual(result['backend']['DJANGO_ALLOWED_HOSTS'], 'dev.example.com,api.dev.example.com')
        self.assertEqual(result['backend']['DJANGO_SETTINGS_MODULE'], 'config.settings.prod')

    def test_deployment_always_serves_private_s3_directly(self):
        self.secret['MEDIA_PUBLIC_BASE_URL'] = 'https://old-cdn.example.com'
        backend = manage.environments(self.secret, 'eu-west-1')['backend']
        self.assertEqual(backend['MEDIA_PUBLIC_BASE_URL'], '')
        self.assertEqual(backend['MEDIA_SIGNED_URLS'], 'True')

    def test_environment_specific_repositories_use_run_number_tags(self):
        registry = '790702264138.dkr.ecr.eu-west-1.amazonaws.com'
        for environment in ('dev', 'prod'):
            with self.subTest(environment=environment):
                self.assertEqual(manage.image_references(registry, environment, '42'), {
                    'backend': f'{registry}/nautelo/backend/{environment}:42',
                    'frontend': f'{registry}/nautelo/frontend/{environment}:42',
                })

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

    def http_secret(self):
        return dict(self.secret, DEPLOY_ALLOW_HTTP='true',
                    NEXT_PUBLIC_BASE_URL='http://108.130.226.143',
                    NEXT_PUBLIC_API_BASE_URL='http://108.130.226.143')

    def test_http_dev_uses_same_origin_and_insecure_cookie_only_when_opted_in(self):
        values = manage.environments(self.http_secret(), 'eu-west-1', 'dev')
        backend = values['backend']
        self.assertEqual(backend['DJANGO_SETTINGS_MODULE'], 'config.settings.dev_http')
        self.assertEqual(backend['DEPLOY_ENVIRONMENT'], 'dev')
        self.assertEqual(backend['REFRESH_COOKIE_SECURE'], 'False')
        self.assertEqual(backend['DJANGO_ALLOWED_HOSTS'], '108.130.226.143')
        self.assertEqual(backend['DJANGO_CORS_ALLOWED_ORIGINS'], 'http://108.130.226.143')
        self.assertEqual(values['frontend']['NEXT_PUBLIC_API_BASE_URL'], 'http://108.130.226.143')

    def test_http_rejected_for_prod_or_without_explicit_opt_in(self):
        with self.assertRaisesRegex(ValueError, 'never prod'):
            manage.environments(self.http_secret(), 'eu-west-1', 'prod')
        secret = self.http_secret()
        secret.pop('DEPLOY_ALLOW_HTTP')
        with self.assertRaises(ValueError):
            manage.environments(secret, 'eu-west-1', 'dev')

    def test_http_rejects_mismatched_hosts_extra_ports_or_mixed_schemes(self):
        for api in ('http://108.130.226.143:8080', 'https://108.130.226.143', 'http://108.130.226.144'):
            with self.subTest(api=api), self.assertRaises(ValueError):
                manage.environments(dict(self.http_secret(), NEXT_PUBLIC_API_BASE_URL=api), 'eu-west-1', 'dev')

    def test_https_dev_keeps_secure_settings(self):
        backend = manage.environments(self.secret, 'eu-west-1', 'dev')['backend']
        self.assertEqual(backend['DJANGO_SETTINGS_MODULE'], 'config.settings.prod')
        self.assertEqual(backend['REFRESH_COOKIE_SECURE'], 'True')

    def test_http_deploy_starts_proxy_before_apps_and_checks_routed_api(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / 'deploy').mkdir()
            (root / 'deploy/config.dev.json').write_text(json.dumps({
                'region': 'eu-west-1', 'registry': '790702264138.dkr.ecr.eu-west-1.amazonaws.com',
                'secret_id': 'nautelo/dev'}))
            commands = []
            def fake_run(command, **kwargs):
                commands.append(command)
                if 'get-secret-value' in command:
                    return manage.subprocess.CompletedProcess(command, 0, stdout=json.dumps(json.dumps(self.http_secret())))
                if 'get-login-password' in command:
                    return manage.subprocess.CompletedProcess(command, 0, stdout=b'password')
                return manage.subprocess.CompletedProcess(command, 0)
            with patch.object(manage, 'ROOT', root), patch.object(manage, 'run', side_effect=fake_run), \
                 patch.object(manage.subprocess, 'run', return_value=manage.subprocess.CompletedProcess([], 0)), \
                 patch('sys.argv', ['manage.py', 'deploy', 'dev', '42']):
                manage.main()
            proxy_up = next(i for i, cmd in enumerate(commands)
                            if 'up' in cmd and any('proxy.dev-http.yml' in value for value in cmd))
            apps_up = next(i for i, cmd in enumerate(commands) if 'up' in cmd and 'api' in cmd)
            migration = next(i for i, cmd in enumerate(commands) if 'run' in cmd and 'migrate' in cmd)
            self.assertLess(migration, proxy_up)
            self.assertLess(proxy_up, apps_up)
            self.assertIn('http://127.0.0.1/api/v1/health/', commands[-1])
            self.assertIn('Host: 108.130.226.143', commands[-1])

    def test_https_same_origin_dev_and_prod_aliases(self):
        for environment, host, hosts in [('dev', 'dev.nautelo.com', 'dev.nautelo.com'),
                                         ('prod', 'nautelo.com', 'nautelo.com,www.nautelo.com')]:
            with self.subTest(environment=environment):
                values = manage.environments(dict(self.secret, NEXT_PUBLIC_BASE_URL=f'https://{host}',
                    NEXT_PUBLIC_API_BASE_URL=f'https://{host}'), 'eu-west-1', environment)
                backend = values['backend']
                self.assertEqual(backend['DJANGO_ALLOWED_HOSTS'], hosts)
                self.assertEqual(backend['DJANGO_SETTINGS_MODULE'], 'config.settings.prod')
                self.assertEqual(backend['REFRESH_COOKIE_SECURE'], 'True')
                self.assertEqual(backend['TRUSTED_PROXY_COUNT'], '1')
                self.assertIn(f'https://{host}', backend['DJANGO_CSRF_TRUSTED_ORIGINS'])
                if environment == 'prod':
                    self.assertIn('https://www.nautelo.com', backend['DJANGO_CORS_ALLOWED_ORIGINS'])

    def test_api_base_rejects_api_suffix_to_prevent_duplicate_paths(self):
        with self.assertRaises(ValueError):
            manage.environments(dict(self.secret, NEXT_PUBLIC_BASE_URL='https://dev.nautelo.com',
                NEXT_PUBLIC_API_BASE_URL='https://dev.nautelo.com/api'), 'eu-west-1', 'dev')

    def test_deploy_stops_if_migration_fails(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / 'deploy').mkdir()
            (root / 'deploy/config.dev.json').write_text(json.dumps({
                'region': 'eu-west-1', 'registry': '790702264138.dkr.ecr.eu-west-1.amazonaws.com', 'secret_id': 'nautelo/dev'}))
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
                 patch('sys.argv', ['manage.py', 'deploy', 'dev', '42']):
                with self.assertRaises(manage.subprocess.CalledProcessError):
                    manage.main()
            self.assertFalse(any('--force-recreate' in cmd for cmd in commands))


if __name__ == '__main__':
    unittest.main()


class DiskHygieneTests(unittest.TestCase):
    def test_reclaim_prunes_images_and_build_cache_but_never_volumes(self):
        with patch.object(manage.subprocess, 'run') as run:
            manage.reclaim_disk_space()
        commands = [call.args[0] for call in run.call_args_list]
        self.assertEqual(commands, [['docker', 'image', 'prune', '-af'], ['docker', 'builder', 'prune', '-af']])
        self.assertFalse(any('volume' in part or '--volumes' in part for command in commands for part in command))

    def test_a_nearly_full_disk_stops_the_deploy_with_a_clear_message(self):
        usage = manage.shutil._ntuple_diskusage(100, 99, 1024**2)
        with patch.object(manage.shutil, 'disk_usage', return_value=usage):
            with self.assertRaisesRegex(ValueError, 'free on /'):
                manage.ensure_free_space()

    def test_enough_free_space_passes(self):
        usage = manage.shutil._ntuple_diskusage(100 * 1024**3, 10 * 1024**3, 90 * 1024**3)
        with patch.object(manage.shutil, 'disk_usage', return_value=usage):
            manage.ensure_free_space()
