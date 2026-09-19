#!/usr/bin/env python3
"""Build tagged ECR images or deploy one environment; never print secret values."""
import argparse
import fcntl
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
from urllib.parse import quote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
REQUIRED = (
    "DJANGO_SECRET_KEY", "POSTGRES_PASSWORD", "CONTACT_HASH_SECRET",
    "INTERNAL_SERVICE_SECRET", "NEXT_PUBLIC_BASE_URL", "NEXT_PUBLIC_API_BASE_URL",
    "OBJECT_STORAGE_BUCKET_NAME", "OBJECT_STORAGE_REGION", "STRIPE_SECRET_KEY",
    "STRIPE_PUBLISHABLE_KEY", "STRIPE_WEBHOOK_SECRET", "EMAIL_BACKEND", "DEFAULT_FROM_EMAIL",
)


def run(args, **kwargs):
    return subprocess.run(args, check=True, **kwargs)


def origin(value):
    parsed = urlsplit(value)
    if (parsed.scheme != "https" or not parsed.hostname or parsed.username or
            parsed.password or parsed.port or parsed.path not in ("", "/") or
            parsed.query or parsed.fragment):
        raise ValueError("Public URLs must be HTTPS origins without paths, credentials or ports")
    if not re.fullmatch(r"[a-zA-Z0-9.-]+", parsed.hostname):
        raise ValueError("Invalid public hostname")
    return "https://" + parsed.hostname


def environments(secret, region):
    if not isinstance(secret, dict):
        raise ValueError("SecretString must contain a JSON object")
    for key, value in secret.items():
        if not re.fullmatch(r"[A-Z][A-Z0-9_]*", key) or not isinstance(value, str):
            raise ValueError("Secret must contain uppercase environment names and string values")
        if any(c in value for c in ("\n", "\r", "\0")):
            raise ValueError("Secret values must be single-line strings")
    missing = [key for key in REQUIRED if not secret.get(key)]
    if missing:
        raise ValueError("Missing secret keys: " + ", ".join(missing))
    # Runtime containers use the SDK credential chain and the EC2 instance role.
    forbidden = [k for k in secret if k.startswith("AWS_") or k in (
        "OBJECT_STORAGE_ACCESS_KEY", "OBJECT_STORAGE_SECRET_KEY", "OBJECT_STORAGE_ENDPOINT_URL")]
    if forbidden:
        raise ValueError("Remove static AWS credentials/endpoint overrides from the AWS deployment secret")
    web = origin(secret["NEXT_PUBLIC_BASE_URL"])
    api = origin(secret["NEXT_PUBLIC_API_BASE_URL"])
    if web == api:
        raise ValueError("Use distinct frontend and API hostnames")
    backend = {k: v for k, v in secret.items() if not k.startswith("NEXT_PUBLIC_") and k != "POSTGRES_PASSWORD"}
    backend.update({
        "DJANGO_SETTINGS_MODULE": "config.settings.prod", "AWS_DEFAULT_REGION": region,
        "DJANGO_ALLOWED_HOSTS": urlsplit(api).hostname,
        "DJANGO_CSRF_TRUSTED_ORIGINS": f"{web},{api}",
        "DJANGO_CORS_ALLOWED_ORIGINS": web, "PUBLIC_BASE_URL": web,
        "TRUSTED_PROXY_COUNT": "1", "REFRESH_COOKIE_SECURE": "True",
        "DATABASE_URL": "postgres://nautelo:" + quote(secret["POSTGRES_PASSWORD"], safe="") + "@postgres:5432/nautelo",
        "REDIS_URL": "redis://redis:6379/0", "CELERY_BROKER_URL": "redis://redis:6379/1",
        "CELERY_RESULT_BACKEND": "redis://redis:6379/2", "CHANNELS_REDIS_URL": "redis://redis:6379/3",
        "MEDIA_SIGNED_URLS": "True", "MEDIA_PUBLIC_BASE_URL": "",
    })
    frontend = {"NEXT_PUBLIC_BASE_URL": web, "NEXT_PUBLIC_API_BASE_URL": api,
                "INTERNAL_SERVICE_SECRET": secret["INTERNAL_SERVICE_SECRET"]}
    postgres = {"POSTGRES_DB": "nautelo", "POSTGRES_USER": "nautelo", "POSTGRES_PASSWORD": secret["POSTGRES_PASSWORD"]}
    return {"backend": backend, "frontend": frontend, "postgres": postgres}


def write_env(path, values):
    """Compose raw env files preserve $, #, quotes and spaces literally."""
    fd, temporary = tempfile.mkstemp(dir=path.parent, prefix=".env-")
    try:
        with os.fdopen(fd, "w") as handle:
            handle.write("".join(f"{k}={v}\n" for k, v in sorted(values.items())))
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("build", "deploy"))
    parser.add_argument("environment", choices=("dev", "prod"))
    parser.add_argument("tag", help="Explicit immutable tag, for example dev-<git SHA> or prod-<git SHA>")
    parser.add_argument("--config", type=Path)
    args = parser.parse_args()
    if not re.fullmatch(args.environment + r"-[a-zA-Z0-9_][a-zA-Z0-9_.-]{0,119}", args.tag):
        parser.error("Tag must begin with the selected environment and a hyphen")
    config = json.loads((args.config or ROOT / f"deploy/config.{args.environment}.json").read_text())
    region, registry = config["region"], config["registry"]
    if not re.fullmatch(r"\d{12}\.dkr\.ecr\.[a-z0-9-]+\.amazonaws\.com", registry):
        raise ValueError("registry must be a private ECR registry hostname")
    # Lock across the complete deploy, including fetching and writing secrets.
    runtime = ROOT / "deploy/runtime" / args.environment
    runtime.mkdir(parents=True, exist_ok=True, mode=0o700)
    runtime.chmod(0o700)
    with (runtime / ".lock").open("w") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        raw = run(["aws", "secretsmanager", "get-secret-value", "--region", region,
                   "--secret-id", config["secret_id"], "--query", "SecretString", "--output", "json"],
                  capture_output=True, text=True).stdout
        values = environments(json.loads(json.loads(raw)), region)
        images = {part: f"{registry}/nautelo-{part}:{args.tag}" for part in ("backend", "frontend")}
        password = run(["aws", "ecr", "get-login-password", "--region", region], capture_output=True).stdout
        run(["docker", "login", "--username", "AWS", "--password-stdin", registry], input=password)
        if args.action == "build":
            branch = "dev" if args.environment == "dev" else "main"
            actual = os.environ.get("GITHUB_REF_NAME") or run(
                ["git", "branch", "--show-current"], cwd=ROOT, capture_output=True, text=True).stdout.strip()
            if actual != branch:
                raise ValueError(f"Build {args.environment} from branch {branch}")
            for part in ("backend", "frontend"):
                command = ["docker", "build", "--pull", "-f", f"deploy/{part}.Dockerfile", "-t", images[part]]
                if part == "frontend":
                    for key in ("NEXT_PUBLIC_API_BASE_URL", "NEXT_PUBLIC_BASE_URL"):
                        command += ["--build-arg", f"{key}={values['frontend'][key]}"]
                run(command + ["."], cwd=ROOT)
            # Build both successfully before publishing either image.
            for ref in images.values():
                run(["docker", "push", ref])
            print("Published " + ", ".join(images.values()))
            return
        for part, variables in values.items():
            write_env(runtime / f"{part}.env", variables)
        deployment = {"BACKEND_IMAGE": images["backend"], "FRONTEND_IMAGE": images["frontend"], "RUNTIME_DIR": str(runtime)}
        # Retain the exact image references for logs/exec/rollback operations.
        write_env(runtime / "compose.env", deployment)
        process_env = dict(os.environ, **deployment)
        compose = ["docker", "compose", "--project-name", f"nautelo-{args.environment}",
                   "-f", str(ROOT / f"deploy/docker-compose.{args.environment}.yml")]
        run(compose + ["config", "--quiet"], env=process_env)
        network = f"nautelo-{args.environment}-edge"
        if subprocess.run(["docker", "network", "inspect", network], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode:
            run(["docker", "network", "create", network])
        run(compose + ["pull"], env=process_env)
        run(compose + ["up", "-d", "--wait", "postgres", "redis"], env=process_env)
        # Run migrations for EVERY deployment; completed one-shot containers must not be reused.
        run(compose + ["run", "--rm", "--no-deps", "migrate"], env=process_env)
        run(compose + ["up", "-d", "--no-deps", "--force-recreate", "--wait", "--wait-timeout", "180",
                       "api", "worker", "beat", "web"], env=process_env)
        print(f"Deployed {args.environment}: {args.tag}")


if __name__ == "__main__":
    try:
        main()
    except subprocess.CalledProcessError as exc:
        # Captured AWS responses may contain secrets. Do not echo stdout/stderr.
        raise SystemExit(f"Command failed (exit {exc.returncode}); deployment stopped") from None
    except (ValueError, KeyError, OSError) as exc:
        raise SystemExit(f"Deployment configuration error: {exc}") from None
