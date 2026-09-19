# NAUTA deployment runbook (spec section 35)

## Environment

Backend (`config.settings.prod` is the default for wsgi/asgi; `manage.py` still defaults to dev):

| Variable | Notes |
|---|---|
| `DJANGO_SECRET_KEY` | required |
| `DJANGO_ALLOWED_HOSTS` | required, explicit hostnames, no `*` (prod refuses to boot otherwise) |
| `DJANGO_CORS_ALLOWED_ORIGINS`, `DJANGO_CSRF_TRUSTED_ORIGINS` | frontend origin(s) |
| `DATABASE_URL`, `REDIS_URL`, `CELERY_BROKER_URL`, `CELERY_RESULT_BACKEND`, `CHANNELS_REDIS_URL` | |
| `OBJECT_STORAGE_ENDPOINT_URL`, `_REGION`, `_BUCKET_NAME`, `_ACCESS_KEY`, `_SECRET_KEY` | media uploads |
| `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` | per environment |
| `INTERNAL_SERVICE_SECRET` | must equal the frontend value; authenticates forwarded client IPs |
| `MEDIA_PUBLIC_BASE_URL` | public CDN origin in front of the media bucket; empty = images show placeholders |
| `TRUSTED_PROXY_COUNT`, `IPV6_HASH_PREFIX_BITS`, `CONTACT_HASH_SECRET` | throttling and contact hashing |
| `PUBLIC_BASE_URL`, `DEFAULT_FROM_EMAIL`, `EMAIL_BACKEND`, `REFRESH_COOKIE_SECURE`, `JWT_*` | |

Frontend: `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_BASE_URL` (canonical site URL used in sitemap and share links), `INTERNAL_SERVICE_SECRET`.

Processes: web (gunicorn/uvicorn on `config.asgi`), Celery worker with queues `default`, `media`, `maintenance`, Celery beat (hourly stale-media cleanup, daily token flush, entitlement expiry), Next.js.

## Sequence

1. Back up the database and verify the restore.
2. `manage.py migrate` (all migrations are additive; `listings.0010` backfills listing slugs).
3. Deploy code with feature flags off.
4. Configure Stripe products and the webhook in staging, then production; attach real price ids.
5. Smoke-test with internal staff accounts (queue, decision, taxonomy mapping, upload).
6. Enable flags in this order: `listing_revisions`, taxonomy/snapshot read paths, `unified_inquiries` and `contact_unlock`, `finance_estimates` and `unique_listing_views`, `individual_entitlements` and `stripe_entitlement_checkout` (with media upgrade), `combined_services_professionals` and redirects.
7. Watch error rate, queue depth, paid-not-fulfilled count and moderation latency.

## Rollback

- Turn mutation flags off first; keep additive schema and data.
- Revert the release only while old code stays schema-compatible.
- Never delete a fulfilled entitlement; reconcile through the ledger.
- Stopping view recording keeps existing counts.
- If the combined directory must be disabled, route at the proxy without removing canonical data and avoid redirect loops.

## Known gaps before launch

No virus scanner or video processing (ffmpeg) is wired; images are decoded and re-encoded without metadata by Pillow, videos are validated by signature only. No CSP header. No WebSocket client in the frontend (notifications poll). See `docs/superpowers/PHASE-TRACKER.md` for the rest.

## Landing page and EC2 stack

- `landing/`: static holding site (home, privacy, terms, contact) for email-provider domain approval. Edit `landing/site.json` (legal name, address, VAT, contact email, domain), run `python landing/build.py`, upload `landing/dist/` to any static host.
- `deploy/`: `docker-compose.prod.yml` (postgres, redis, migrate, api/daphne, celery worker+beat, Next.js, nginx), Dockerfiles, `nginx.conf` (TLS + WebSocket + `X-Forwarded-Proto`), `.env.example`. Run: `docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env up -d --build`.

## Demo data on dev

`python manage.py seed_demo_data --reset --enable-flags` fills a dev/staging database with about 90 listings (72 published, plus pending, draft, rejected, suspended and expired ones), 10 brokers, 14 service providers, conversations, entitlements, guides and ads, with photos stored through the configured object storage. Every account uses the `@demo.nauta.test` domain and one shared password (printed at the end, or set with `--password`). `--reset-only` removes it again. The command refuses to run when `DEPLOY_ENVIRONMENT=prod`. On the EC2 dev stack run it inside the `api` container, for example:

```bash
sudo sh -c 'cd "$(cat /opt/nautelo/deploy/runtime/dev/last-successful-release)" && docker compose --env-file /opt/nautelo/deploy/runtime/dev/compose.env -f deploy/docker-compose.dev.yml exec api python manage.py seed_demo_data --reset --enable-flags'
```
