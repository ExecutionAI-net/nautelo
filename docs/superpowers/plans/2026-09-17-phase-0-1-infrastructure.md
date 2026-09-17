# NAUTA Phase 0/1 — Repository Scaffolding & Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the NAUTA monorepo (Django headless API + Next.js frontend) with a working local infrastructure skeleton — database, cache, object storage, background queue, WebSocket layer, and a Stripe webhook stub — so every later feature phase has real infrastructure to build against instead of stubs.

**Architecture:** Django (`backend/`) is a pure headless API (DRF + admin only, no server-rendered end-user HTML). Next.js (`frontend/`) owns all UI, including SSR/SSG for SEO-critical public pages. Postgres, Redis and MinIO (S3-compatible storage) run in Docker Compose; Django and Next.js run natively on the host. Auth will use JWT (`djangorestframework-simplejwt`) once a `User` model exists in Phase 3 — this plan only wires the configuration, since Phase 1 has no domain models yet.

**Tech Stack:** Python 3.12, Django 5.2, Django REST Framework, `djangorestframework-simplejwt`, Django Channels + `channels-redis`, Celery + Redis, `django-storages` (S3), Stripe Python SDK, `uv` (Python tooling), PostgreSQL 16, Redis 7, MinIO; Next.js 15 (App Router, TypeScript), Tailwind CSS, `pnpm`.

**Spec:** [`NAUTA_PRODUCTION_IMPLEMENTATION_SPEC.md`](../../../NAUTA_PRODUCTION_IMPLEMENTATION_SPEC.md) §3 (architecture), §7–9 (Phase 0/1), and the decisions recorded in [`ACTIVITY.md`](../../../ACTIVITY.md). This plan implements the spec's **Phase 0** (repository audit/scope freeze — collapsed to "record decisions," since there is no pre-existing codebase to audit) and **Phase 1** (infrastructure and environments) in full; it does **not** implement any domain model, business rule, or user-facing feature — those start at spec Phase 2 onward and need their own plan(s).

## Execution Model

This plan is executed with `superpowers:subagent-driven-development`, adapted from its
default single-branch flow to a **per-task PR model** per the project owner's
requirement that no untested or conflicting code reaches `dev`:

1. Task 1 (this section) is done directly by the controller (not a subagent) and pushed
   straight to `dev` — it is docs/config only, nothing to review or test in isolation.
2. For every task from Task 2 onward: branch off the current tip of `dev`
   (`git checkout -b task-N-<slug> dev`), run the normal implementer → task-reviewer →
   fix-loop cycle from `subagent-driven-development` on that branch, then open a PR
   into `dev` (`gh pr create`).
3. The controller merges a task's PR only when **both** are true: the CI workflow
   (added in Task 1, Step 4 below) is green, and the branch is a fast-forward or
   cleanly auto-mergeable onto `dev` (no conflicts). Because tasks are strictly
   sequential and each branches from the just-merged `dev`, there is never a second
   branch in flight to conflict with.
4. After merging, delete the task branch and branch the next task from the new `dev`
   tip. The final whole-branch review from `subagent-driven-development` still runs
   once at the end, against the full range merged into `dev` during this plan.
5. Subagents never talk to each other directly; coordination is sequential execution
   (never two implementers in parallel) plus the shared ledger file plus the
   controller carrying interfaces/decisions forward into each new dispatch — this
   avoids the conflict class parallel agents would otherwise create, rather than
   detecting and resolving it after the fact.

## Global Constraints

- Backend: Python 3.12+, Django 5.2 LTS, DRF for all JSON APIs, PostgreSQL 16+, Redis for cache/Celery broker/Channels layer, Celery for async work, Django Channels for WebSocket, Stripe Checkout only for NAUTA's own entitlement purchases (never the boat sale price), S3-compatible object storage with private staging (spec §3).
- Separate Celery queues are required: `default`, `notifications`, `media`, `maintenance` (spec §9).
- Secrets must never appear in templates, logs, repository files, or staff-editable settings; Stripe test/live identifiers must never be mixed (spec §9).
- Required env vars (spec §9): `DATABASE_URL`, `REDIS_URL`, `DJANGO_SECRET_KEY`, `DJANGO_ALLOWED_HOSTS`, `DJANGO_CSRF_TRUSTED_ORIGINS`, `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `EMAIL_BACKEND`/provider credentials, `DEFAULT_FROM_EMAIL`, `OBJECT_STORAGE_*` credentials, `CONTACT_HASH_SECRET`, `PUBLIC_BASE_URL`. This plan adds `CELERY_BROKER_URL`, `CELERY_RESULT_BACKEND`, `CHANNELS_REDIS_URL` (split Redis logical DBs per concern — a deliberate refinement of the spec's single `REDIS_URL`) and JWT lifetime settings.
- Phase 1 definition of done (spec §9): health checks cover web, database, Redis and worker availability; a WebSocket connection works; a Stripe test webhook reaches the verified endpoint; media upload uses signed/private storage and cannot execute uploaded content.
- Django is **headless**: no app in this plan renders end-user HTML. Django admin is the only server-rendered surface, reserved for staff tooling in later phases.
- This plan does not create the 14 domain apps listed in spec §3 (`accounts`, `brokers`, `listings`, etc.) — those are scaffolded when the phase that needs them starts (Phase 2 onward). This plan creates one infrastructure-only app, `common`, for health checks and the Stripe webhook signature-verification stub.

---

## File Structure

```
nautelo/
├── .gitignore
├── .github/workflows/ci.yml
├── ACTIVITY.md
├── NAUTA_PRODUCTION_IMPLEMENTATION_SPEC.md
├── docker-compose.yml
├── docs/superpowers/plans/2026-09-17-phase-0-1-infrastructure.md   (this file)
├── backend/
│   ├── pyproject.toml
│   ├── .env.example
│   ├── manage.py
│   ├── config/
│   │   ├── __init__.py          # exposes celery_app
│   │   ├── celery.py
│   │   ├── asgi.py
│   │   ├── wsgi.py
│   │   ├── urls.py
│   │   └── settings/
│   │       ├── __init__.py
│   │       ├── base.py
│   │       ├── dev.py
│   │       ├── test.py
│   │       └── prod.py
│   └── common/
│       ├── __init__.py
│       ├── apps.py
│       ├── consumers.py
│       ├── routing.py
│       ├── tasks.py
│       ├── views.py
│       └── tests/
│           ├── __init__.py
│           ├── stripe_helpers.py
│           ├── test_health.py
│           ├── test_celery.py
│           ├── test_storage.py
│           ├── test_stripe_webhook.py
│           └── test_websocket.py
└── frontend/
    ├── .env.local.example
    ├── package.json
    ├── tailwind.config.ts
    └── src/
        ├── app/
        │   ├── layout.tsx
        │   ├── page.tsx
        │   └── health/page.tsx
        └── lib/api/client.ts
```

---

### Task 1: Repository scaffolding, `.gitignore`, CI workflow, git init, push to `dev`

**Files:**
- Create: `.gitignore`
- Create: `.github/workflows/ci.yml`
- Create: `backend/` (empty dir placeholder, populated in Task 3)
- Create: `frontend/` (empty dir placeholder, populated in Task 9)

**Interfaces:**
- Produces: a GitHub Actions workflow (`CI`) that runs on every push/PR against `dev`/`main`, with a `backend` job (Django `check` + `pytest`, Postgres/Redis as GH Actions services, MinIO started via `docker compose`) and a `frontend` job (`pnpm build` + `pnpm lint`). Both jobs detect whether `backend/pyproject.toml` / `frontend/package.json` exist yet and no-op successfully if not, so this workflow is green from the very first push even before Tasks 3 and 9 create those projects.

- [ ] **Step 1: Create `.gitignore`**

```gitignore
# Design reference (not source code — kept locally only)
stitch_nauta_nautical_marketplace*.zip

# Python
__pycache__/
*.py[cod]
backend/.venv/
*.egg-info/

# Django
backend/staticfiles/
backend/media/
*.sqlite3
backend/.env

# Node
node_modules/
frontend/.next/
frontend/out/
frontend/.env.local

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
```

- [ ] **Step 2: Write the CI workflow**

`.github/workflows/ci.yml`:

```yaml
name: CI

on:
  pull_request:
    branches: [dev, main]
  push:
    branches: [dev, main]

jobs:
  backend:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_DB: nautelo
          POSTGRES_USER: nautelo
          POSTGRES_PASSWORD: nautelo
        ports: ["5432:5432"]
        options: >-
          --health-cmd "pg_isready -U nautelo"
          --health-interval 5s --health-timeout 5s --health-retries 5
      redis:
        image: redis:7-alpine
        ports: ["6379:6379"]
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 5s --health-timeout 5s --health-retries 5
    env:
      DJANGO_SETTINGS_MODULE: config.settings.test
      DJANGO_SECRET_KEY: ci-test-secret
      DJANGO_ALLOWED_HOSTS: localhost,127.0.0.1
      DJANGO_CSRF_TRUSTED_ORIGINS: http://localhost:3000
      DATABASE_URL: postgres://nautelo:nautelo@localhost:5432/nautelo
      REDIS_URL: redis://localhost:6379/0
      CELERY_BROKER_URL: redis://localhost:6379/1
      CELERY_RESULT_BACKEND: redis://localhost:6379/2
      CHANNELS_REDIS_URL: redis://localhost:6379/3
      STRIPE_SECRET_KEY: sk_test_ci
      STRIPE_PUBLISHABLE_KEY: pk_test_ci
      STRIPE_WEBHOOK_SECRET: whsec_test_ci
      EMAIL_BACKEND: django.core.mail.backends.console.EmailBackend
      DEFAULT_FROM_EMAIL: noreply@nautelo.local
      OBJECT_STORAGE_ENDPOINT_URL: http://localhost:9010
      OBJECT_STORAGE_ACCESS_KEY: nautelo
      OBJECT_STORAGE_SECRET_KEY: nautelo123
      OBJECT_STORAGE_BUCKET_NAME: nautelo-media
      OBJECT_STORAGE_REGION: us-east-1
      CONTACT_HASH_SECRET: ci-test-secret
      PUBLIC_BASE_URL: http://localhost:3000
    steps:
      - uses: actions/checkout@v4

      - name: Check backend project exists
        id: check
        run: |
          if [ -f "backend/pyproject.toml" ]; then
            echo "exists=true" >> "$GITHUB_OUTPUT"
          else
            echo "exists=false" >> "$GITHUB_OUTPUT"
            echo "No backend/pyproject.toml yet — nothing to test."
          fi

      - name: Install uv
        if: steps.check.outputs.exists == 'true'
        uses: astral-sh/setup-uv@v3
        with:
          python-version: "3.12"

      - name: Install dependencies
        if: steps.check.outputs.exists == 'true'
        working-directory: backend
        run: uv sync

      - name: Start MinIO (via root docker compose)
        if: steps.check.outputs.exists == 'true'
        run: |
          docker compose -f docker-compose.yml up -d --wait minio
          docker compose -f docker-compose.yml up createbuckets

      - name: Django system check
        if: steps.check.outputs.exists == 'true'
        working-directory: backend
        run: uv run python manage.py check

      - name: Run tests
        if: steps.check.outputs.exists == 'true'
        working-directory: backend
        run: uv run pytest -v

  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Check frontend project exists
        id: check
        run: |
          if [ -f "frontend/package.json" ]; then
            echo "exists=true" >> "$GITHUB_OUTPUT"
          else
            echo "exists=false" >> "$GITHUB_OUTPUT"
            echo "No frontend/package.json yet — nothing to build."
          fi

      - uses: pnpm/action-setup@v4
        if: steps.check.outputs.exists == 'true'
        with:
          version: 9

      - uses: actions/setup-node@v4
        if: steps.check.outputs.exists == 'true'
        with:
          node-version: 20
          cache: pnpm
          cache-dependency-path: frontend/pnpm-lock.yaml

      - name: Install dependencies
        if: steps.check.outputs.exists == 'true'
        working-directory: frontend
        run: pnpm install --frozen-lockfile

      - name: Lint
        if: steps.check.outputs.exists == 'true'
        working-directory: frontend
        run: pnpm lint

      - name: Build
        if: steps.check.outputs.exists == 'true'
        working-directory: frontend
        env:
          NEXT_PUBLIC_API_BASE_URL: http://localhost:8000
        run: pnpm build
```

Note: Postgres and Redis use GitHub Actions' native `services:` support (their default images already run the right server on start). MinIO does not — its image needs `server /data` passed as a command, which `services:` cannot override — so MinIO is instead started with the same root `docker-compose.yml` used for local dev, keeping one source of truth for its setup. The `exists` checks make every job a safe no-op (green) on early PRs, before Tasks 3/9 create `backend/pyproject.toml` and `frontend/package.json`. There is deliberately no job-level `defaults.run.working-directory` — `backend/`/`frontend/` don't exist as real directories in the repo until Tasks 3/9 create files inside them (git does not track empty directories), so a job-level working-directory override would fail the very existence-check step meant to detect that. Each step that needs to run inside `backend/`/`frontend/` sets `working-directory:` individually, after the existence check (against a repo-root-relative path) has already run successfully. `DATABASE_URL`/`REDIS_URL`/`CELERY_*`/`CHANNELS_REDIS_URL` above intentionally still use the standard ports `5432`/`6379` — CI's Postgres/Redis are GitHub Actions' own isolated `services:` containers, unrelated to the loopback-only, non-standard-port `docker-compose.yml` used for local dev (see the port ruling in Task 2). Only `OBJECT_STORAGE_ENDPOINT_URL` had to move to `9010`, because CI's MinIO comes from that same `docker-compose.yml`.

- [ ] **Step 3: Initialize git and make the first commit**

```bash
git init
git checkout -b dev
git add .gitignore .github/workflows/ci.yml ACTIVITY.md NAUTA_PRODUCTION_IMPLEMENTATION_SPEC.md docs/superpowers/plans/2026-09-17-phase-0-1-infrastructure.md
git commit -m "docs: add project spec, activity log, ci workflow, and phase 0/1 plan"
```

- [ ] **Step 4: Add the GitHub remote and push**

```bash
git remote add origin https://github.com/executionainet/nautelo.git
git push -u origin dev
```

Expected: the `dev` branch on GitHub now shows these files, and the Actions tab shows the `CI` workflow running (both jobs green, since neither `backend/` nor `frontend/` has a project yet). Confirm with `gh run list --branch dev` or in a browser.

---

### Task 2: Docker Compose infrastructure (Postgres, Redis, MinIO)

**Files:**
- Create: `docker-compose.yml`

**Interfaces:**
- Produces: Postgres reachable at `localhost:5433` (db `nautelo`, user `nautelo`, password `nautelo`); Redis reachable at `localhost:6380`; MinIO S3 API at `localhost:9010` (console at `localhost:9011`, user `nautelo`, password `nautelo123`), with a `nautelo-media` bucket pre-created. All three are bound to `127.0.0.1` only and use non-default host ports — see the ruling after Step 2 below.

- [ ] **Step 1: Write `docker-compose.yml`**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: nautelo
      POSTGRES_USER: nautelo
      POSTGRES_PASSWORD: nautelo
    ports:
      - "127.0.0.1:5433:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U nautelo"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "127.0.0.1:6380:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  minio:
    image: quay.io/minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: nautelo
      MINIO_ROOT_PASSWORD: nautelo123
    ports:
      - "127.0.0.1:9010:9000"
      - "127.0.0.1:9011:9001"
    volumes:
      - minio_data:/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 5s
      timeout: 5s
      retries: 5

  createbuckets:
    image: quay.io/minio/mc:latest
    depends_on:
      minio:
        condition: service_healthy
    entrypoint: >
      /bin/sh -c "
      mc alias set local http://minio:9000 nautelo nautelo123;
      mc mb -p local/nautelo-media;
      exit 0;
      "

volumes:
  postgres_data:
  minio_data:
```

- [ ] **Step 2: Bring the stack up and verify**

```bash
docker compose up -d
docker compose ps
```

Expected: `postgres`, `redis`, `minio` show `healthy`; `createbuckets` exits with code 0.

```bash
docker compose exec postgres pg_isready -U nautelo
docker compose exec redis redis-cli ping
curl -f http://localhost:9010/minio/health/live
```

Expected: `accepting connections`, `PONG`, HTTP 200 respectively. (`docker compose exec` runs inside the container's network namespace, so it always uses the container-internal ports 5432/6379 regardless of the host port mapping — only the `curl` from the host needs the mapped port.)

**Ruling 2 (recorded as a hotfix after Task 2 merged, confirmed by Task 3's CI run — not in the original plan text):** `minio/minio:latest` and `minio/mc:latest` are not pullable from Docker Hub (`docker.io`) — pulling either returns "pull access denied ... repository does not exist" both locally (hit during Task 2) and in GitHub Actions (hit during Task 3's PR check), so this is not an environment quirk, it is the current state of those Docker Hub repositories. Fixed permanently by using `quay.io/minio/minio:latest` and `quay.io/minio/mc:latest` instead — the images are otherwise identical, just hosted on a different registry. The `docker-compose.yml` block above and the CI workflow's "Start MinIO" step (which reuses this same file) both already reflect this.

**Ruling 1 (recorded during Task 2 execution, not in the original plan text):** the host ports above were changed from the obvious defaults (`5432`, `6379`, `9000`/`9001`) to `5433`/`6380`/`9010`/`9011`, all bound to `127.0.0.1` only, for two reasons found during implementation: (1) this dev machine already runs another project's stack on the default ports, and colliding with it caused Task 2's implementer to stop that unrelated project's containers as a side effect; (2) an automated security review of the committed `docker-compose.yml` correctly flagged that publishing Postgres/Redis/MinIO on `0.0.0.0` with dev-grade credentials is unnecessary exposure — binding to loopback costs nothing locally (every consumer in this plan connects via `localhost` anyway) and closes that off. Container-internal ports are unchanged; only the host-side mapping moved. **This changes every `localhost:5432`/`6379`/`9000` reference elsewhere in this plan** — Task 3's `.env.example` and the CI workflow's `OBJECT_STORAGE_ENDPOINT_URL` are updated accordingly below.

- [ ] **Step 3: Commit**

```bash
git add docker-compose.yml
git commit -m "chore: add docker compose for postgres, redis, minio"
```

---

### Task 3: Django project skeleton (uv, settings split, DRF + JWT config)

**Files:**
- Create: `backend/pyproject.toml`, `backend/manage.py`
- Create: `backend/config/__init__.py`, `backend/config/urls.py`, `backend/config/wsgi.py`, `backend/config/asgi.py` (asgi finalized in Task 6)
- Create: `backend/config/settings/__init__.py`, `base.py`, `dev.py`, `test.py`, `prod.py`
- Create: `backend/.env.example`
- Create: `backend/common/__init__.py`, `backend/common/apps.py`

**Interfaces:**
- Produces: `config.settings.dev` / `config.settings.test` / `config.settings.prod` settings modules; `common` Django app registered in `INSTALLED_APPS`; DRF configured with `rest_framework_simplejwt.authentication.JWTAuthentication` as the default authentication class (no login endpoint yet — added in Phase 3 once `User` exists).

- [ ] **Step 1: Initialize the `uv` project and add dependencies**

```bash
cd backend
uv init --name nautelo-backend --python 3.12 --no-readme
uv add django==5.2.* djangorestframework django-cors-headers "psycopg[binary]" django-environ celery redis channels channels-redis djangorestframework-simplejwt django-storages boto3 stripe
uv add --dev pytest pytest-django pytest-asyncio pytest-cov
```

- [ ] **Step 2: Create the Django project**

```bash
uv run django-admin startproject config .
uv run python manage.py startapp common
```

- [ ] **Step 3: Split settings into `config/settings/`**

Delete the generated `config/settings.py` and create the package:

`backend/config/settings/__init__.py` — empty file.

`backend/config/settings/base.py`:

```python
from datetime import timedelta
from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parent.parent.parent
env = environ.Env()
environ.Env.read_env(BASE_DIR / ".env")

SECRET_KEY = env("DJANGO_SECRET_KEY")
DEBUG = env.bool("DJANGO_DEBUG", default=False)
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS", default=[])
CSRF_TRUSTED_ORIGINS = env.list("DJANGO_CSRF_TRUSTED_ORIGINS", default=[])

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework_simplejwt",
    "corsheaders",
    "channels",
    "storages",
    "common",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

DATABASES = {"default": env.db("DATABASE_URL")}

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": env("REDIS_URL"),
    }
}

CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {"hosts": [env("CHANNELS_REDIS_URL")]},
    }
}

CELERY_BROKER_URL = env("CELERY_BROKER_URL")
CELERY_RESULT_BACKEND = env("CELERY_RESULT_BACKEND")
CELERY_TASK_DEFAULT_QUEUE = "default"
CELERY_TASK_ROUTES = {
    "common.tasks.*": {"queue": "default"},
}

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(
        minutes=env.int("JWT_ACCESS_TOKEN_LIFETIME_MINUTES", default=15)
    ),
    "REFRESH_TOKEN_LIFETIME": timedelta(
        days=env.int("JWT_REFRESH_TOKEN_LIFETIME_DAYS", default=7)
    ),
}

STORAGES = {
    "default": {
        "BACKEND": "storages.backends.s3.S3Storage",
    },
    "staticfiles": {
        "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
    },
}
AWS_ACCESS_KEY_ID = env("OBJECT_STORAGE_ACCESS_KEY")
AWS_SECRET_ACCESS_KEY = env("OBJECT_STORAGE_SECRET_KEY")
AWS_STORAGE_BUCKET_NAME = env("OBJECT_STORAGE_BUCKET_NAME")
AWS_S3_ENDPOINT_URL = env("OBJECT_STORAGE_ENDPOINT_URL")
AWS_S3_REGION_NAME = env("OBJECT_STORAGE_REGION", default="us-east-1")
AWS_S3_ADDRESSING_STYLE = "path"
AWS_DEFAULT_ACL = None
AWS_QUERYSTRING_AUTH = True

STRIPE_SECRET_KEY = env("STRIPE_SECRET_KEY")
STRIPE_PUBLISHABLE_KEY = env("STRIPE_PUBLISHABLE_KEY")
STRIPE_WEBHOOK_SECRET = env("STRIPE_WEBHOOK_SECRET")

CONTACT_HASH_SECRET = env("CONTACT_HASH_SECRET")
PUBLIC_BASE_URL = env("PUBLIC_BASE_URL")

EMAIL_BACKEND = env("EMAIL_BACKEND")
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL")

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True
STATIC_URL = "static/"
```

`backend/config/settings/dev.py`:

```python
from .base import *  # noqa: F401,F403

DEBUG = True
CORS_ALLOW_ALL_ORIGINS = True
```

`backend/config/settings/test.py`:

```python
from .base import *  # noqa: F401,F403

DEBUG = False
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True
CHANNEL_LAYERS = {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
```

`backend/config/settings/prod.py`:

```python
from .base import *  # noqa: F401,F403

DEBUG = False
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
CORS_ALLOW_ALL_ORIGINS = False
```

Note: `prod.py` is intentionally minimal here — full hardening (CSP, HSTS, secure cookie flags audit, etc.) is spec Phase 22 (§33.1) and gets its own task then.

- [ ] **Step 4: Write `backend/.env.example`**

```dotenv
DJANGO_SETTINGS_MODULE=config.settings.dev
DJANGO_SECRET_KEY=change-me-in-dev
DJANGO_DEBUG=True
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1
DJANGO_CSRF_TRUSTED_ORIGINS=http://localhost:3000

DATABASE_URL=postgres://nautelo:nautelo@localhost:5433/nautelo
REDIS_URL=redis://localhost:6380/0
CELERY_BROKER_URL=redis://localhost:6380/1
CELERY_RESULT_BACKEND=redis://localhost:6380/2
CHANNELS_REDIS_URL=redis://localhost:6380/3

JWT_ACCESS_TOKEN_LIFETIME_MINUTES=15
JWT_REFRESH_TOKEN_LIFETIME_DAYS=7

STRIPE_SECRET_KEY=sk_test_placeholder
STRIPE_PUBLISHABLE_KEY=pk_test_placeholder
STRIPE_WEBHOOK_SECRET=whsec_test_placeholder

EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
DEFAULT_FROM_EMAIL=noreply@nautelo.local

OBJECT_STORAGE_ENDPOINT_URL=http://localhost:9010
OBJECT_STORAGE_ACCESS_KEY=nautelo
OBJECT_STORAGE_SECRET_KEY=nautelo123
OBJECT_STORAGE_BUCKET_NAME=nautelo-media
OBJECT_STORAGE_REGION=us-east-1

CONTACT_HASH_SECRET=change-me-in-dev
PUBLIC_BASE_URL=http://localhost:3000
```

Then: `cp .env.example .env` (the real `.env` is git-ignored per Task 1).

- [ ] **Step 5: Point `manage.py` and `pyproject.toml` at the dev settings by default, and configure pytest**

In `backend/manage.py`, change the default settings module:

```python
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")
```

Append to `backend/pyproject.toml`:

```toml
[tool.pytest.ini_options]
DJANGO_SETTINGS_MODULE = "config.settings.test"
python_files = ["test_*.py"]
asyncio_mode = "auto"
```

- [ ] **Step 6: Verify the project boots**

```bash
uv run python manage.py check
uv run python manage.py migrate
```

Expected: no errors; migration output shows Django's built-in tables created against the Dockerized Postgres.

- [ ] **Step 7: Commit**

```bash
git add backend/pyproject.toml backend/uv.lock backend/manage.py backend/config backend/common backend/.env.example
git commit -m "feat(backend): django project skeleton with settings split, drf and jwt config"
```

---

### Task 4: Health check endpoint (database, Redis, Celery worker)

**Files:**
- Create: `backend/common/views.py`
- Modify: `backend/config/urls.py`
- Test: `backend/common/tests/__init__.py`, `backend/common/tests/test_health.py`

**Interfaces:**
- Consumes: `config.celery.app`, imported lazily inside `_check_celery` (not at module level) so this task has no hard ordering dependency on Task 5 — if `config/celery.py` doesn't exist yet, the import raises inside the `try`/`except` and the check simply reports `"unavailable"`.
- Produces: `GET /api/v1/health/` → `{"status": "ok"|"degraded", "checks": {"database": "ok"|"unavailable", "redis": "ok"|"unavailable", "celery_worker": "ok"|"unavailable"}}`, HTTP 200 when all checks are `"ok"`, HTTP 503 otherwise. `common.views.HealthCheckView` with `_check_database`, `_check_redis`, `_check_celery` methods (patchable in tests by name).

- [ ] **Step 1: Write the failing tests**

`backend/common/tests/__init__.py` — empty file.

`backend/common/tests/test_health.py`:

```python
from unittest.mock import patch

import pytest
from rest_framework.test import APIClient


@pytest.mark.django_db
def test_health_check_returns_ok_when_all_dependencies_healthy():
    client = APIClient()
    with (
        patch("common.views.HealthCheckView._check_database", return_value="ok"),
        patch("common.views.HealthCheckView._check_redis", return_value="ok"),
        patch("common.views.HealthCheckView._check_celery", return_value="ok"),
    ):
        response = client.get("/api/v1/health/")

    assert response.status_code == 200
    assert response.data == {
        "status": "ok",
        "checks": {"database": "ok", "redis": "ok", "celery_worker": "ok"},
    }


@pytest.mark.django_db
def test_health_check_returns_503_when_a_dependency_is_down():
    client = APIClient()
    with (
        patch("common.views.HealthCheckView._check_database", return_value="ok"),
        patch("common.views.HealthCheckView._check_redis", return_value="unavailable"),
        patch("common.views.HealthCheckView._check_celery", return_value="ok"),
    ):
        response = client.get("/api/v1/health/")

    assert response.status_code == 503
    assert response.data["status"] == "degraded"
    assert response.data["checks"]["redis"] == "unavailable"
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd backend
uv run pytest common/tests/test_health.py -v
```

Expected: `FAIL` / `ERROR` — `/api/v1/health/` doesn't exist yet (404) and `common.views.HealthCheckView` doesn't exist.

- [ ] **Step 3: Implement the view**

`backend/common/views.py`:

```python
from django.core.cache import cache
from django.db import connection
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView


class HealthCheckView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        checks = {
            "database": self._check_database(),
            "redis": self._check_redis(),
            "celery_worker": self._check_celery(),
        }
        healthy = all(value == "ok" for value in checks.values())
        return Response(
            {"status": "ok" if healthy else "degraded", "checks": checks},
            status=200 if healthy else 503,
        )

    def _check_database(self):
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
            return "ok"
        except Exception:
            return "unavailable"

    def _check_redis(self):
        try:
            cache.set("healthcheck-probe", "ok", timeout=5)
            return "ok" if cache.get("healthcheck-probe") == "ok" else "unavailable"
        except Exception:
            return "unavailable"

    def _check_celery(self):
        try:
            from config.celery import app as celery_app

            pings = celery_app.control.inspect(timeout=1).ping()
            return "ok" if pings else "unavailable"
        except Exception:
            return "unavailable"
```

Wire it into `backend/config/urls.py`:

```python
from django.contrib import admin
from django.urls import path

from common.views import HealthCheckView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/health/", HealthCheckView.as_view(), name="health-check"),
]
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
uv run pytest common/tests/test_health.py -v
```

Expected: both tests `PASS`.

- [ ] **Step 5: Manual end-to-end verification against real infrastructure**

With `docker compose up -d` running (Task 2) and a Celery worker started (Task 5's verification step):

```bash
uv run python manage.py runserver
curl -s http://localhost:8000/api/v1/health/ | python -m json.tool
```

Expected: `{"status": "ok", "checks": {"database": "ok", "redis": "ok", "celery_worker": "ok"}}`. Stop the worker and re-run `curl` — expect `"celery_worker": "unavailable"` and HTTP 503.

- [ ] **Step 6: Commit**

```bash
git add backend/common/views.py backend/common/tests backend/config/urls.py
git commit -m "feat(backend): add /api/v1/health/ endpoint with db, redis and celery checks"
```

---

### Task 5: Celery configuration (4 queues) and a smoke-test task

**Files:**
- Create: `backend/config/celery.py`
- Modify: `backend/config/__init__.py`
- Create: `backend/common/tasks.py`
- Test: `backend/common/tests/test_celery.py`

**Interfaces:**
- Produces: `config.celery.app` (the Celery application instance, consumed by Task 4's health check); `common.tasks.ping` — a `@shared_task` returning the string `"pong"`, routed to the `default` queue.

- [ ] **Step 1: Write the failing test**

`backend/common/tests/test_celery.py`:

```python
from common.tasks import ping


def test_ping_task_returns_pong():
    result = ping.delay()
    assert result.get(timeout=5) == "pong"
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
uv run pytest common/tests/test_celery.py -v
```

Expected: `FAIL` — `ModuleNotFoundError` / `ImportError`, `common.tasks` does not exist yet.

- [ ] **Step 3: Implement Celery config and the task**

`backend/config/celery.py`:

```python
import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")

app = Celery("nautelo")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()

app.conf.task_routes = {
    "common.tasks.*": {"queue": "default"},
}
```

`backend/config/__init__.py`:

```python
from .celery import app as celery_app

__all__ = ("celery_app",)
```

`backend/common/tasks.py`:

```python
from celery import shared_task


@shared_task(queue="default")
def ping():
    return "pong"
```

Note: `config/settings/test.py` (Task 3) already sets `CELERY_TASK_ALWAYS_EAGER = True`, so `ping.delay()` executes synchronously in the test process — no live broker required for this test.

- [ ] **Step 4: Run the test to verify it passes**

```bash
uv run pytest common/tests/test_celery.py -v
```

Expected: `PASS`.

- [ ] **Step 5: Manual verification with a real worker against the 4 required queues**

```bash
uv run celery -A config worker -Q default,notifications,media,maintenance -l info
```

In a second terminal:

```bash
uv run python manage.py shell -c "from common.tasks import ping; print(ping.delay().get(timeout=5))"
```

Expected: worker log shows the task received and executed on the `default` queue; shell prints `pong`. This also satisfies the health check's `celery_worker: ok` state from Task 4.

- [ ] **Step 6: Commit**

```bash
git add backend/config/celery.py backend/config/__init__.py backend/common/tasks.py backend/common/tests/test_celery.py
git commit -m "feat(backend): configure celery with 4 queues and a smoke-test task"
```

---

### Task 6: Django Channels + Redis channel layer (WebSocket smoke test)

**Files:**
- Create: `backend/common/consumers.py`, `backend/common/routing.py`
- Modify: `backend/config/asgi.py`
- Test: `backend/common/tests/test_websocket.py`

**Interfaces:**
- Produces: `ws://localhost:8000/ws/health/` — an echo consumer (`common.consumers.EchoConsumer`) that accepts any connection and echoes back `{"echo": <received JSON>}`. This is infrastructure-only; the real authenticated notifications consumer is built in spec Phase 18 once `accounts`/`notifications` apps exist.

- [ ] **Step 1: Write the failing test**

`backend/common/tests/test_websocket.py`:

```python
import pytest
from channels.testing import WebsocketCommunicator

from config.asgi import application


@pytest.mark.asyncio
async def test_echo_consumer_echoes_message():
    communicator = WebsocketCommunicator(application, "/ws/health/")
    connected, _ = await communicator.connect()
    assert connected

    await communicator.send_json_to({"ping": "pong"})
    response = await communicator.receive_json_from()

    assert response == {"echo": {"ping": "pong"}}
    await communicator.disconnect()
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
uv run pytest common/tests/test_websocket.py -v
```

Expected: `FAIL` — `common.consumers` / `common.routing` do not exist yet.

- [ ] **Step 3: Implement the consumer, routing, and ASGI application**

`backend/common/consumers.py`:

```python
import json

from channels.generic.websocket import AsyncWebsocketConsumer


class EchoConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        await self.accept()

    async def disconnect(self, close_code):
        pass

    async def receive(self, text_data):
        data = json.loads(text_data)
        await self.send(text_data=json.dumps({"echo": data}))
```

`backend/common/routing.py`:

```python
from django.urls import re_path

from common.consumers import EchoConsumer

websocket_urlpatterns = [
    re_path(r"ws/health/$", EchoConsumer.as_asgi()),
]
```

`backend/config/asgi.py`:

```python
import os

from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")
django_asgi_app = get_asgi_application()

from channels.auth import AuthMiddlewareStack  # noqa: E402
from channels.routing import ProtocolTypeRouter, URLRouter  # noqa: E402

from common.routing import websocket_urlpatterns  # noqa: E402

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": AuthMiddlewareStack(URLRouter(websocket_urlpatterns)),
    }
)
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
uv run pytest common/tests/test_websocket.py -v
```

Expected: `PASS`. (This test uses the `InMemoryChannelLayer` from `config/settings/test.py` — it verifies consumer/routing logic, not the Redis wiring itself.)

- [ ] **Step 5: Manual verification of the real Redis-backed channel layer**

```bash
uv run python manage.py runserver
```

In a second terminal, using `websockets` (already available via `uv run python -c`, no extra install needed if `channels-redis`'s deps pulled it in — otherwise `uv add --dev websockets` once):

```bash
uv run python -c "
import asyncio
import websockets

async def main():
    async with websockets.connect('ws://localhost:8000/ws/health/') as ws:
        await ws.send('{\"ping\": \"pong\"}')
        print(await ws.recv())

asyncio.run(main())
"
```

Expected: prints `{"echo": {"ping": "pong"}}`. Check `docker compose exec redis redis-cli client list` shows a connection from the Django process, confirming the `channels_redis.core.RedisChannelLayer` is actually in use (dev settings use `base.py`'s Redis-backed `CHANNEL_LAYERS`, not the test override).

- [ ] **Step 6: Commit**

```bash
git add backend/common/consumers.py backend/common/routing.py backend/config/asgi.py backend/common/tests/test_websocket.py
git commit -m "feat(backend): wire django channels with redis-backed layer and an echo consumer"
```

---

### Task 7: S3-compatible storage wiring (MinIO) with a round-trip test

**Files:**
- Test: `backend/common/tests/test_storage.py`

**Interfaces:**
- Consumes: `STORAGES["default"]` configured in Task 3 (`storages.backends.s3.S3Storage`), the `nautelo-media` bucket created in Task 2.
- Produces: confirmation that `django.core.files.storage.default_storage` reads/writes through to MinIO.

- [ ] **Step 1: Write the failing test**

`backend/common/tests/test_storage.py`:

```python
import pytest
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage


def test_default_storage_round_trip():
    path = default_storage.save("healthcheck/test.txt", ContentFile(b"nautelo"))
    try:
        assert default_storage.exists(path)
        with default_storage.open(path) as f:
            assert f.read() == b"nautelo"
    finally:
        default_storage.delete(path)
```

- [ ] **Step 2: Run the test to verify it fails (or is skipped) without infra**

```bash
docker compose stop minio
uv run pytest common/tests/test_storage.py -v
```

Expected: `FAIL` with a connection error to `http://localhost:9010` — proving the test genuinely exercises MinIO rather than a mock.

- [ ] **Step 3: Bring MinIO back up and confirm the config from Task 3 is correct**

```bash
docker compose start minio
```

No code changes needed here — `STORAGES`, `AWS_*` settings were already written in Task 3, Step 3, and the bucket was created in Task 2. This step exists to prove the round trip against real infrastructure.

- [ ] **Step 4: Run the test to verify it passes**

```bash
uv run pytest common/tests/test_storage.py -v
```

Expected: `PASS`. Confirm in the MinIO console (`http://localhost:9011`, login `nautelo`/`nautelo123`) that the `healthcheck/test.txt` object briefly appeared and was deleted (or watch `docker compose logs minio` during the test run).

- [ ] **Step 5: Verify uploaded content cannot be executed**

Confirm `AWS_S3_ADDRESSING_STYLE = "path"` and that no code path serves files from the bucket through Django's static/app server — files are only ever served via signed/direct S3 URLs. Record this as satisfied per spec §9 ("Media upload uses signed/private staging and cannot execute uploaded content") — actual upload-intent/signed-URL endpoints are built in spec Phase 15, not this plan.

- [ ] **Step 6: Commit**

```bash
git add backend/common/tests/test_storage.py
git commit -m "test(backend): verify default storage round-trips through minio"
```

---

### Task 8: Stripe webhook signature-verification endpoint

**Files:**
- Modify: `backend/common/views.py`
- Modify: `backend/config/urls.py`
- Create: `backend/common/tests/stripe_helpers.py`
- Test: `backend/common/tests/test_stripe_webhook.py`

**Interfaces:**
- Produces: `POST /api/v1/stripe/webhook/` → HTTP 200 for a validly signed payload, HTTP 400 for an invalid/missing signature. No event persistence or business logic yet — `ProcessedWebhookEvent` and fulfillment logic are spec Phase 14 (`payments` app), built in a later plan.

- [ ] **Step 1: Write the signature-generation test helper and the failing tests**

`backend/common/tests/stripe_helpers.py`:

```python
import hashlib
import hmac
import time


def generate_stripe_signature(payload: bytes, secret: str) -> str:
    timestamp = int(time.time())
    signed_payload = f"{timestamp}.{payload.decode()}"
    signature = hmac.new(
        secret.encode(), signed_payload.encode(), hashlib.sha256
    ).hexdigest()
    return f"t={timestamp},v1={signature}"
```

`backend/common/tests/test_stripe_webhook.py`:

```python
import json

from common.tests.stripe_helpers import generate_stripe_signature


def test_stripe_webhook_accepts_a_validly_signed_event(client, settings):
    settings.STRIPE_WEBHOOK_SECRET = "whsec_test_secret"
    payload = json.dumps(
        {"id": "evt_test", "type": "checkout.session.completed"}
    ).encode()
    signature = generate_stripe_signature(payload, "whsec_test_secret")

    response = client.post(
        "/api/v1/stripe/webhook/",
        data=payload,
        content_type="application/json",
        HTTP_STRIPE_SIGNATURE=signature,
    )

    assert response.status_code == 200


def test_stripe_webhook_rejects_an_invalid_signature(client, settings):
    settings.STRIPE_WEBHOOK_SECRET = "whsec_test_secret"
    payload = json.dumps(
        {"id": "evt_test", "type": "checkout.session.completed"}
    ).encode()

    response = client.post(
        "/api/v1/stripe/webhook/",
        data=payload,
        content_type="application/json",
        HTTP_STRIPE_SIGNATURE="t=1,v1=deadbeef",
    )

    assert response.status_code == 400
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
uv run pytest common/tests/test_stripe_webhook.py -v
```

Expected: `FAIL` — `/api/v1/stripe/webhook/` returns 404.

- [ ] **Step 3: Implement the view**

Add to `backend/common/views.py`:

```python
import stripe
from django.conf import settings
from django.http import HttpResponse
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt


@method_decorator(csrf_exempt, name="dispatch")
class StripeWebhookView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        payload = request.body
        sig_header = request.META.get("HTTP_STRIPE_SIGNATURE", "")
        try:
            stripe.Webhook.construct_event(
                payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
            )
        except (ValueError, stripe.error.SignatureVerificationError):
            return HttpResponse(status=400)
        return HttpResponse(status=200)
```

Add the route in `backend/config/urls.py`:

```python
from common.views import HealthCheckView, StripeWebhookView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/health/", HealthCheckView.as_view(), name="health-check"),
    path("api/v1/stripe/webhook/", StripeWebhookView.as_view(), name="stripe-webhook"),
]
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
uv run pytest common/tests/test_stripe_webhook.py -v
```

Expected: both `PASS`. Note `stripe.Webhook.construct_event` verifies signatures locally (HMAC against the shared secret) — no network call to Stripe is made, so these tests need no real Stripe account.

- [ ] **Step 5: Manual verification with the real Stripe CLI (optional but recommended)**

If the Stripe CLI is available:

```bash
stripe listen --forward-to localhost:8000/api/v1/stripe/webhook/
stripe trigger checkout.session.completed
```

Expected: the forwarded event returns HTTP 200; update `backend/.env`'s `STRIPE_WEBHOOK_SECRET` with the value `stripe listen` prints first. Skip this step if no Stripe account/CLI is set up yet — the automated tests already prove the signature-verification logic.

- [ ] **Step 6: Commit**

```bash
git add backend/common/views.py backend/config/urls.py backend/common/tests/stripe_helpers.py backend/common/tests/test_stripe_webhook.py
git commit -m "feat(backend): add stripe webhook endpoint with signature verification"
```

---

### Task 9: Next.js app skeleton with NAUTA design tokens

**Files:**
- Create: `frontend/` (via `create-next-app`)
- Modify: `frontend/tailwind.config.ts`
- Create: `frontend/.env.local.example`
- Create: `frontend/src/lib/api/client.ts`
- Create: `frontend/src/app/health/page.tsx`

**Interfaces:**
- Produces: `apiFetch<T>(path, init?)` in `@/lib/api/client` — a typed fetch wrapper against `process.env.NEXT_PUBLIC_API_BASE_URL`; a `/health` route rendering the Django backend's health status (proves Next.js → Django connectivity).

- [ ] **Step 1: Scaffold the app**

```bash
cd frontend
pnpm create next-app@latest . --typescript --tailwind --app --eslint --src-dir --import-alias "@/*" --use-pnpm --no-turbopack
```

Accept defaults for anything not covered by the flags above.

- [ ] **Step 2: Replace `tailwind.config.ts` with the NAUTA design tokens**

These tokens are extracted verbatim from the approved Stitch design export (`stitch_nauta_nautical_marketplace/nauta_homepage/code.html`) so the real app matches the approved visual direction from day one:

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        "surface-tint": "#496171",
        "secondary-fixed-dim": "#7dd4d9",
        "on-secondary-fixed-variant": "#004f53",
        "surface-container-low": "#f5f3ee",
        "secondary-container": "#97eef3",
        "on-secondary": "#ffffff",
        "on-tertiary": "#ffffff",
        "on-primary": "#ffffff",
        background: "#fbf9f4",
        "error-container": "#ffdad6",
        "surface-container-highest": "#e4e2dd",
        primary: "#001520",
        "surface-variant": "#e4e2dd",
        surface: "#fbf9f4",
        "on-surface-variant": "#42474b",
        "on-tertiary-container": "#a78a54",
        "on-secondary-fixed": "#002021",
        "tertiary-fixed": "#ffdea4",
        "on-tertiary-fixed": "#261900",
        "outline-variant": "#c2c7cc",
        "tertiary-container": "#352400",
        error: "#ba1a1a",
        "primary-container": "#102a38",
        "surface-bright": "#fbf9f4",
        "inverse-primary": "#b0cadc",
        "on-primary-container": "#7992a3",
        "surface-container-high": "#eae8e3",
        "on-primary-fixed": "#021e2c",
        "surface-dim": "#dbdad5",
        "on-background": "#1b1c19",
        "surface-container-lowest": "#ffffff",
        "on-tertiary-fixed-variant": "#5a4314",
        "tertiary-fixed-dim": "#e3c286",
        "on-error-container": "#93000a",
        secondary: "#00696e",
        "on-surface": "#1b1c19",
        "primary-fixed": "#cce6f9",
        tertiary: "#1b1100",
        "surface-container": "#f0eee9",
        "secondary-fixed": "#9af1f6",
        outline: "#73787c",
        "inverse-surface": "#30312e",
        "on-primary-fixed-variant": "#314a59",
        "on-secondary-container": "#006e73",
        "on-error": "#ffffff",
        "primary-fixed-dim": "#b0cadc",
      },
      borderRadius: {
        DEFAULT: "0.125rem",
        lg: "0.25rem",
        xl: "0.5rem",
        full: "0.75rem",
      },
      spacing: {
        "margin-mobile": "1rem",
        margin: "1.5rem",
        "space-md": "1rem",
        "gutter-mobile": "1rem",
        "space-sm": "0.5rem",
        "space-2xl": "4rem",
        "space-lg": "1.5rem",
        "space-xs": "0.25rem",
        "gutter-desktop": "2rem",
        gutter: "1.5rem",
        "margin-desktop": "3rem",
        "space-xl": "2.5rem",
      },
      fontFamily: {
        "title-lg": ["var(--font-plus-jakarta-sans)"],
        "body-sm": ["var(--font-plus-jakarta-sans)"],
        "headline-sm": ["var(--font-playfair-display)"],
        "display-hero": ["var(--font-playfair-display)"],
        "label-sm": ["var(--font-plus-jakarta-sans)"],
        "spec-num": ["var(--font-plus-jakarta-sans)"],
        "body-lg": ["var(--font-plus-jakarta-sans)"],
        "label-md": ["var(--font-plus-jakarta-sans)"],
        "body-md": ["var(--font-plus-jakarta-sans)"],
        "headline-lg": ["var(--font-playfair-display)"],
        "headline-md": ["var(--font-playfair-display)"],
        "title-md": ["var(--font-plus-jakarta-sans)"],
      },
      fontSize: {
        "title-lg": ["18px", { lineHeight: "26px", letterSpacing: "-0.005em", fontWeight: "600" }],
        "body-sm": ["13px", { lineHeight: "18px", fontWeight: "400" }],
        "headline-sm": ["22px", { lineHeight: "30px", fontWeight: "500" }],
        "display-hero": ["56px", { lineHeight: "64px", letterSpacing: "-0.02em", fontWeight: "600" }],
        "label-sm": ["11px", { lineHeight: "14px", letterSpacing: "0.06em", fontWeight: "600" }],
        "spec-num": ["15px", { lineHeight: "20px", letterSpacing: "-0.01em", fontWeight: "500" }],
        "body-lg": ["16px", { lineHeight: "26px", fontWeight: "400" }],
        "label-md": ["12px", { lineHeight: "16px", letterSpacing: "0.04em", fontWeight: "600" }],
        "body-md": ["14px", { lineHeight: "22px", fontWeight: "400" }],
        "headline-lg": ["40px", { lineHeight: "48px", letterSpacing: "-0.015em", fontWeight: "600" }],
        "headline-md": ["28px", { lineHeight: "36px", fontWeight: "500" }],
        "title-md": ["16px", { lineHeight: "24px", fontWeight: "600" }],
      },
    },
  },
};

export default config;
```

Note: the mobile-specific variants from the prototype (`display-hero-mobile`, `headline-lg-mobile`) are dropped here in favor of Tailwind's own responsive prefixes (`md:text-display-hero`) once real components are built — this keeps the token set from duplicating what Tailwind's breakpoint system already does.

- [ ] **Step 3: Wire the two Google Fonts through `next/font/google`**

In `frontend/src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { Playfair_Display, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair-display",
  weight: ["400", "500", "600", "700"],
});

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta-sans",
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "NAUTA",
  description: "Yacht and boat marketplace for Spain and Italy",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
          rel="stylesheet"
        />
      </head>
      <body
        className={`${playfairDisplay.variable} ${plusJakartaSans.variable} bg-surface text-on-surface antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Write the API client**

`frontend/src/lib/api/client.ts`:

```typescript
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(
      `API request failed: ${response.status} ${response.statusText}`,
    );
  }

  return response.json() as Promise<T>;
}
```

- [ ] **Step 5: Write the health page**

`frontend/src/app/health/page.tsx`:

```tsx
import { apiFetch } from "@/lib/api/client";

interface HealthCheckResponse {
  status: string;
  checks: Record<string, string>;
}

export default async function HealthPage() {
  let health: HealthCheckResponse | null = null;
  let error: string | null = null;

  try {
    health = await apiFetch<HealthCheckResponse>("/api/v1/health/", {
      cache: "no-store",
    });
  } catch (err) {
    error = err instanceof Error ? err.message : "Unknown error";
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-8">
      <div className="max-w-md w-full rounded-xl border border-outline-variant p-6 shadow-sm bg-surface-container-lowest">
        <h1 className="font-headline-md text-headline-md text-primary mb-4">
          NAUTA backend status
        </h1>
        {error ? (
          <p className="text-error font-body-md">
            Could not reach backend: {error}
          </p>
        ) : (
          <ul className="space-y-2">
            <li className="font-body-md">
              Overall:{" "}
              <span className="font-semibold">{health?.status}</span>
            </li>
            {health &&
              Object.entries(health.checks).map(([key, value]) => (
                <li
                  key={key}
                  className="font-body-sm text-on-surface-variant"
                >
                  {key}: {value}
                </li>
              ))}
          </ul>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 6: Write `.env.local.example` and set up the local env file**

`frontend/.env.local.example`:

```dotenv
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

```bash
cp .env.local.example .env.local
```

- [ ] **Step 7: Verify the build and manually verify the health page**

```bash
pnpm build
pnpm dev
```

With the Django dev server running (Task 4), open `http://localhost:3000/health` — expected: the page renders "Overall: ok" with `database: ok`, `redis: ok`, `celery_worker: ok` (assuming Docker Compose services and a Celery worker are running).

- [ ] **Step 8: Commit**

```bash
cd ..
git add frontend/
git commit -m "feat(frontend): next.js skeleton with nauta design tokens and backend health page"
```

---

### Task 10: Final integration pass and activity log update

**Files:**
- Modify: `ACTIVITY.md`

**Interfaces:** none — this task only verifies the prior 9 tasks work together and records that fact.

- [ ] **Step 1: Full-stack smoke test**

In separate terminals, from a clean state:

```bash
docker compose up -d
cd backend && uv run python manage.py migrate && uv run python manage.py runserver
```

```bash
cd backend && uv run celery -A config worker -Q default,notifications,media,maintenance -l info
```

```bash
cd frontend && pnpm dev
```

Then verify:

```bash
uv run pytest   # from backend/, full suite
```

Expected: all tests from Tasks 4–8 pass in one run; `http://localhost:3000/health` shows all checks `ok`; `http://localhost:8000/admin/` loads Django admin's login page; `docker compose ps` shows `postgres`, `redis`, `minio` healthy.

- [ ] **Step 2: Update `ACTIVITY.md`**

Append a new entry at the top of the `## Log` section:

```markdown
### 2026-09-17 — Phase 0/1 infrastructure complete

- Implemented `docs/superpowers/plans/2026-09-17-phase-0-1-infrastructure.md` in full.
- Repo scaffolded: `backend/` (Django 5.2 + DRF + JWT config + Celery + Channels + S3 storage + Stripe webhook stub) and `frontend/` (Next.js 15 + Tailwind with NAUTA design tokens), `docker-compose.yml` for Postgres/Redis/MinIO.
- `/api/v1/health/` reports database, Redis and Celery worker status; `/api/v1/stripe/webhook/` verifies signatures (no fulfillment logic yet); `/ws/health/` proves the Redis-backed Channels layer; `/health` on the frontend proves Next.js → Django connectivity.
- Known limitations: no domain apps yet (`accounts`, `listings`, etc. — spec Phase 2+); no real login/JWT-issuing endpoint (needs `User` model, Phase 3); `prod.py` settings are a placeholder, full hardening is Phase 22; frontend has no automated test tooling yet (deferred until real UI logic exists).
- Next: write the Phase 2 plan (shared domain types, `platform_settings` app, audit foundation) per spec §10.
```

Update the "Current State" section to reflect that the infrastructure skeleton now exists (replace "No application code exists yet").

- [ ] **Step 3: Commit and push**

```bash
git add ACTIVITY.md
git commit -m "docs: record phase 0/1 infrastructure completion in activity log"
git push origin dev
```

---

## Known Limitations (carried forward, not fixed by this plan)

- No domain models or business rules exist yet — this plan is infrastructure only.
- JWT is configured but there is no endpoint to obtain a token yet (no `User` model until Phase 3).
- WebSocket auth middleware is Django Channels' default `AuthMiddlewareStack` (session-based); it will need a JWT-aware middleware once real authenticated notifications are built (spec Phase 18).
- `prod.py` is a minimal placeholder; full security/observability hardening is spec Phase 22.
- No frontend automated test tooling (Vitest/Playwright) yet — introduce it when the first real UI component with logic is built.
