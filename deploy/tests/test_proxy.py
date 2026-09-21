import importlib.util
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location('proxy', Path(__file__).parents[1] / 'proxy.py')
proxy = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(proxy)


class CertificateTests(unittest.TestCase):
    def certificate(self, directory, san='DNS:nautelo.com,DNS:*.nautelo.com'):
        subprocess.run(['openssl', 'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '2',
                        '-subj', '/CN=nautelo.com', '-addext', 'subjectAltName=' + san,
                        '-keyout', str(directory / 'origin.key'), '-out', str(directory / 'origin.pem')],
                       check=True, capture_output=True)
        (directory / 'origin.key').chmod(0o600)

    def test_valid_wildcard_certificate_passes(self):
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            self.certificate(directory)
            proxy.check_certificate(directory)

    def test_missing_certificate_stops_before_docker_changes(self):
        with tempfile.TemporaryDirectory() as tmp, patch.object(proxy, 'run') as run:
            with self.assertRaisesRegex(ValueError, 'missing'):
                proxy.check_certificate(Path(tmp))
            run.assert_not_called()

    def test_certificate_without_dev_san_is_rejected_even_when_openssl_exits_zero(self):
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            self.certificate(directory, 'DNS:nautelo.com,DNS:www.nautelo.com')
            with self.assertRaisesRegex(ValueError, 'does not cover dev.nautelo.com'):
                proxy.check_certificate(directory)

    def test_wrong_key_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp, tempfile.TemporaryDirectory() as other:
            directory = Path(tmp)
            self.certificate(directory)
            self.certificate(Path(other))
            (directory / 'origin.key').write_bytes((Path(other) / 'origin.key').read_bytes())
            with self.assertRaisesRegex(ValueError, 'do not match'):
                proxy.check_certificate(directory)

    def test_world_readable_private_key_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            self.certificate(directory)
            (directory / 'origin.key').chmod(0o644)
            with self.assertRaisesRegex(ValueError, '0600'):
                proxy.check_certificate(directory)


class ProxyCutoverTests(unittest.TestCase):
    def test_invalid_nginx_candidate_does_not_stop_existing_proxy(self):
        with tempfile.TemporaryDirectory() as tmp:
            commands = []
            def fake_run(command, **kwargs):
                commands.append(command)
                if command[-2:] == ['nginx', '-t']:
                    raise subprocess.CalledProcessError(1, command)
                return subprocess.CompletedProcess(command, 0, stdout='')
            with patch.object(proxy, 'DESTINATION', Path(tmp)), patch.object(proxy, 'check_certificate'), \
                 patch.object(proxy, 'run', side_effect=fake_run), \
                 patch.object(proxy.subprocess, 'run', return_value=subprocess.CompletedProcess([], 0)):
                with self.assertRaises(subprocess.CalledProcessError):
                    proxy.apply()
            self.assertFalse(any(command[:2] == ['docker', 'stop'] for command in commands))
            self.assertFalse((Path(tmp) / 'nginx.conf').exists())

    def test_valid_candidate_is_checked_before_http_proxy_stops(self):
        with tempfile.TemporaryDirectory() as tmp:
            commands = []
            def fake_run(command, **kwargs):
                commands.append(command)
                output = 'old-http-container\n' if command[:2] == ['docker', 'ps'] else ''
                return subprocess.CompletedProcess(command, 0, stdout=output)
            with patch.object(proxy, 'DESTINATION', Path(tmp)), patch.object(proxy, 'check_certificate'), \
                 patch.object(proxy, 'run', side_effect=fake_run), \
                 patch.object(proxy.subprocess, 'run', return_value=subprocess.CompletedProcess([], 0)):
                proxy.apply()
            validation = next(i for i, command in enumerate(commands) if command[-2:] == ['nginx', '-t'])
            stop = next(i for i, command in enumerate(commands) if command[:2] == ['docker', 'stop'])
            self.assertLess(validation, stop)
            self.assertEqual(commands[stop], ['docker', 'stop', 'old-http-container'])
            self.assertTrue((Path(tmp) / 'nginx.conf').is_file())
            self.assertTrue(any('--force-recreate' in command for command in commands))
