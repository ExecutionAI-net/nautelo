# Nautelo deployment: Cloudflare HTTPS on one EC2

Region: `eu-west-1`; AWS account: `790702264138`; EC2: `i-0a628b595b9e8d709` (current public IP `108.130.226.143`). Use an Elastic IP or keep DNS updated if the address changes.

| Environment | Deployment branch | Site | API example | S3 bucket |
|---|---|---|---|---|
| dev | `dev` | `https://dev.nautelo.com` | `https://dev.nautelo.com/api/v1/health/` | `nautelo-dev` |
| prod | `main` | `https://nautelo.com` and `https://www.nautelo.com` | `/api/v1/health/` on either hostname | `nautelo-prod` |

`ww.nautelo.com` was treated as a typo for `www.nautelo.com`; no `ww` route is configured. Both production names serve the application. The canonical public URL used for generated links is `https://nautelo.com`.

Nginx routes `/api/`, `/ws/`, and `/admin/` to Django, `/static/` to Django's collected assets, and all other paths to Next.js. It preserves the existing `/api/v1/...` paths. **Do not append `/api` to `NEXT_PUBLIC_API_BASE_URL`: the frontend already adds it.**

The two environments retain separate databases, Redis, ClamAV, workers, schedules, networks and volumes. One shared proxy publishes only ports 80 and 443. It can start before prod is deployed; the undeployed environment returns 502 without preventing dev from running. Media remains in private S3 with signed PUT/GET URLs, independent of Cloudflare site proxying.

## 1. Cloudflare DNS and SSL

Create these **Proxied** (orange cloud) records:

| Type | Name | Target |
|---|---|---|
| A | `@` | `108.130.226.143` |
| A | `dev` | `108.130.226.143` |
| CNAME | `www` | `nautelo.com` |

Remove conflicting records. Only add AAAA records if this EC2 is configured for public IPv6. In Cloudflare SSL/TLS, select **Full (strict)**, not Flexible, and enable Always Use HTTPS. Confirm Cloudflare's edge certificate is active for all three names before testing.

Under SSL/TLS → Origin Server, create/download an Origin CA certificate covering **`nautelo.com` and `*.nautelo.com`** (or all three exact hostnames). Download PEM certificate and unencrypted private key. Name the files `origin.pem` and `origin.key`.

[Cloudflare Origin CA certificates](https://developers.cloudflare.com/ssl/origin-configuration/origin-ca/) are trusted by Cloudflare, not ordinary browser trust stores. Keep the DNS records proxied; direct-IP HTTPS and DNS-only browser access will not validate this certificate. [Full (strict)](https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/full-strict/) validates the origin certificate.

## 2. Upload the certificate to EC2 before merging

Run from the computer holding your certificate/key (add `-i /path/to/ssh-key` to scp if needed):

```bash
scp origin.pem origin.key ubuntu@108.130.226.143:~/
```

Then in your EC2 SSH session:

```bash
sudo install -d -m 700 /etc/nautelo/tls
sudo install -m 644 ~/origin.pem /etc/nautelo/tls/origin.pem
sudo install -m 600 ~/origin.key /etc/nautelo/tls/origin.key
rm ~/origin.pem ~/origin.key
sudo openssl x509 -in /etc/nautelo/tls/origin.pem -noout -subject -dates -ext subjectAltName
```

These are the exact persistent paths mounted read-only into Nginx. Do not upload the private key to GitHub, ECR, Secrets Manager, or the repository. This deployment uses Origin CA certificates rather than Certbot/Let's Encrypt; no ACME or Certbot renewal job is needed. Monitor expiration and replace the files before expiry. After rotation, reload the proxy:

```bash
sudo docker compose -f /opt/nautelo/proxy/docker-compose.proxy.yml exec -T nginx nginx -t
sudo docker compose -f /opt/nautelo/proxy/docker-compose.proxy.yml exec -T nginx nginx -s reload
```

Python 3, AWS CLI v2, Docker, Compose 2.30+, `openssl`, and `curl` must be installed on EC2. Your SSM Agent and existing instance role remain in use. Keep ports 80/443 available; SSH can remain restricted to your administration IP. Application ports, PostgreSQL, Redis and ClamAV do not need host ingress rules.

## 3. Update the AWS secrets

Change only these keys in each existing JSON secret; retain database passwords, signing secrets, payment credentials and other app settings. The values below are partial updates, not complete secret replacements.

**`nautelo/dev`:**

```json
{
  "DEPLOY_ALLOW_HTTP": "false",
  "NEXT_PUBLIC_BASE_URL": "https://dev.nautelo.com",
  "NEXT_PUBLIC_API_BASE_URL": "https://dev.nautelo.com",
  "OBJECT_STORAGE_BUCKET_NAME": "nautelo-dev",
  "OBJECT_STORAGE_REGION": "eu-west-1"
}
```

**`nautelo/prod`:**

```json
{
  "DEPLOY_ALLOW_HTTP": "false",
  "NEXT_PUBLIC_BASE_URL": "https://nautelo.com",
  "NEXT_PUBLIC_API_BASE_URL": "https://nautelo.com",
  "OBJECT_STORAGE_BUCKET_NAME": "nautelo-prod",
  "OBJECT_STORAGE_REGION": "eu-west-1"
}
```

The helper derives allowed hosts, CSRF trusted origins, CORS origins, secure cookies, database/Redis URLs, and production Django settings. Prod trusts both `nautelo.com` and `www.nautelo.com`. Removing `DEPLOY_ALLOW_HTTP` has the same effect as setting it to `false`. Do not keep the previous `true` value.

Public URLs are embedded in Next.js at build time, so update the secrets **before starting a new workflow run**. Existing IP-test images need rebuilding. Both base URLs must be origins without `/api` or other paths; the validation rejects a path to prevent `/api/api/v1/...` requests.

The complete required key set remains in `secret.example.json`. Use separate random signing/database secrets per environment. The example console email backend logs emails; use your configured delivery backend for real email. AWS credentials are supplied by the EC2 role; do not put static AWS keys in the secret. Updating a PostgreSQL password in Secrets Manager alone does not rotate an existing database role password.

## 4. Update private S3 CORS

Using AWS administration credentials with `s3:PutBucketCORS`, apply the checked-in configurations from the repository root:

```bash
aws s3api put-bucket-cors --region eu-west-1 --bucket nautelo-dev --cors-configuration file://deploy/aws/s3-cors.dev.json
aws s3api put-bucket-cors --region eu-west-1 --bucket nautelo-prod --cors-configuration file://deploy/aws/s3-cors.prod.json
```

Dev allows `https://dev.nautelo.com`; prod allows both `https://nautelo.com` and `https://www.nautelo.com`. Keep S3 Block Public Access enabled. Browser uploads/downloads continue going directly to signed S3 URLs; `MEDIA_PUBLIC_BASE_URL` is kept empty by the deployment helper.

## 5. GitHub Actions and branch deployment

Create GitHub environments `dev` and `prod`. Allow branch `dev` for the dev environment and `main` for prod. Both environments can use your shared GitHub OIDC role and the same EC2 instance.

| Environment variable | dev | prod |
|---|---|---|
| `AWS_BUILD_ROLE_ARN` | Your GitHub OIDC role ARN | Same role, if it trusts both environments |
| `EC2_INSTANCE_ID` | `i-0a628b595b9e8d709` | Same |
| `ECR_REGISTRY` (optional override) | `790702264138.dkr.ecr.eu-west-1.amazonaws.com` | Same |
| `AWS_SECRET_ID` (optional override) | `nautelo/dev` | `nautelo/prod` |

No GitHub secrets are needed for AWS authentication. The shared OIDC role must trust both `repo:OWNER/REPO:environment:dev` and `repo:OWNER/REPO:environment:prod`. The IAM examples under `deploy/aws/` cover secret reads, ECR build/push, and SSM commands; EC2 separately needs secret reads, ECR pulls, S3 access and SSM Agent permissions. Both roles run administrative commands on the same host; these environments are not an IAM/OS isolation boundary.

Image references retain the workflow run number:

```text
790702264138.dkr.ecr.eu-west-1.amazonaws.com/nautelo/frontend/dev:GITHUB_RUN_NUMBER
790702264138.dkr.ecr.eu-west-1.amazonaws.com/nautelo/backend/dev:GITHUB_RUN_NUMBER
790702264138.dkr.ecr.eu-west-1.amazonaws.com/nautelo/frontend/prod:GITHUB_RUN_NUMBER
790702264138.dkr.ecr.eu-west-1.amazonaws.com/nautelo/backend/prod:GITHUB_RUN_NUMBER
```

Push `devops` and merge into `dev` first. CI runs tests, builds/pushes images, smoke-tests frontend startup, and sends the release to EC2 through SSM. No repository clone or manual proxy-file copying is required on EC2. After dev works, merge the changes to `main` to deploy prod.

The HTTPS deployment:

1. Fetches that environment's secret and checks certificate files, key permissions, expiration, SAN coverage and matching public keys **before migrations or app replacement**.
2. Pulls images, starts infrastructure, and runs migrations/collectstatic.
3. Locks the shared proxy, prepares both proxy networks/static volumes, and runs `nginx -t` on the candidate configuration with the actual certificate. Only after validation does it stop the old `nautelo-dev-http-proxy` container.
4. Installs shared proxy files under `/opt/nautelo/proxy` and starts/reloads Nginx on 80/443. An unchanged config does not force container recreation; updates can briefly interrupt both environments. The other app stack is not redeployed.
5. Starts the selected environment's app containers, waits for their health checks, then checks the API through local HTTPS Nginx routing with the domain's SNI. That local routing check skips public CA verification because Origin CA is not in the host public CA store; Cloudflare's external Full (strict) verification remains enabled.

This is not a zero-downtime rollout. Use backward-compatible migrations or planned maintenance. Failure does not automatically roll back images, migrations or proxy files. Certificate/config validation failures leave the old proxy running; a later start failure may require restoring it or correcting the config. Do not delete volumes to recover a failed deployment.

## 6. Verify and operate

From your computer after dev succeeds:

```bash
curl --fail https://dev.nautelo.com/api/v1/health/
curl --fail https://dev.nautelo.com/login/
```

After prod succeeds:

```bash
curl --fail https://nautelo.com/api/v1/health/
curl --fail https://www.nautelo.com/api/v1/health/
```

Use normal certificate verification for these public Cloudflare URLs. Test login/refresh, Django admin styles, WebSocket notifications (`wss://HOST/ws/notifications/`), and one media upload/download in each environment. Verify prod from both apex and www. The health API uses `/api/v1/health/`; `/api` itself need not be a valid Django endpoint.

On EC2:

```bash
sudo docker compose -f /opt/nautelo/proxy/docker-compose.proxy.yml logs --tail=100 nginx
sudo sh -c 'cd "$(cat /opt/nautelo/deploy/runtime/dev/last-successful-release)" && docker compose --env-file /opt/nautelo/deploy/runtime/dev/compose.env -f deploy/docker-compose.dev.yml logs --tail=100 api worker web'
```

Use prod paths for prod logs. SSM release directories remain under `/opt/nautelo/releases/ENV/TAG`; runtime secret files stay under `/opt/nautelo/deploy/runtime/ENV` with restrictive permissions. Retain releases/images required for recovery and back up databases. Never use `down -v` on persistent stacks unless intentionally destroying their data.

Cloudflare settings: bypass cache for dynamic application/API/auth/admin responses and WebSockets; do not apply a blanket Cache Everything rule. Cache immutable `/_next/static/` assets separately if desired. Browser S3 traffic does not pass through Cloudflare. No Cloudflare API token is needed by this pipeline.

Nginx restores client IPs using `CF-Connecting-IP` only for Cloudflare's published source ranges in `cloudflare-realip.conf`, then replaces `X-Forwarded-For` with the verified address. Django retains `TRUSTED_PROXY_COUNT=1`. Direct non-Cloudflare requests cannot spoof this trusted header. Review the IP allowlist when Cloudflare changes its [IPv4](https://www.cloudflare.com/ips-v4) or [IPv6](https://www.cloudflare.com/ips-v6) ranges. This is header trust, not a firewall: optionally restrict EC2 web ingress to Cloudflare source ranges once the cutover works.

Certificate renewal/rotation is manual: install the replacement certificate/key, validate them, then reload Nginx. Keep Cloudflare DNS proxied. Cloudflare 525/526 errors usually require checking the origin certificate/key, hostname coverage, validity, encryption mode, and port 443 reachability.

## Validation

```bash
python3 -m unittest discover -s deploy/tests -v
```

CI also renders Compose configs and tests Nginx syntax with a generated test certificate. Real Cloudflare edge/origin connectivity must be verified after deploying with your certificate and DNS. `nginx.conf`, `docker-compose.proxy.yml`, `cloudflare-realip.conf` and `proxy.py` travel together in the SSM bundle. The legacy dev HTTP files remain only for explicitly opted-in IP tests; do not re-enable them after the domain cutover.

### Server-rendered pages receive HTML instead of API JSON

Deployment automatically sets `INTERNAL_API_BASE_URL=http://api:8000` in the
frontend runtime environment. Server-rendered listings, directory pages and ads
call Django over the environment's private Compose network, preserving the
public API Host and forwarded protocol. No additional Secrets Manager key is
needed. Browser requests still use `NEXT_PUBLIC_API_BASE_URL` (the origin only,
for example `https://dev.nautelo.com`, without `/api`). Rebuild and redeploy after
this change; restarting an older image will not update the fetch code.

A `200 text/html` API response does not establish that uploads or Docker volumes
are missing. Compare the local origin and public edge from EC2 with GET requests
(no redirect following):

```bash
curl --silent --show-error --insecure \
  --resolve dev.nautelo.com:443:127.0.0.1 \
  -H 'Accept: application/json' -D - -o /dev/null \
  https://dev.nautelo.com/api/v1/listings/
curl --silent --show-error \
  -H 'Accept: application/json' -D - -o /dev/null \
  https://dev.nautelo.com/api/v1/listings/
```

`--insecure` is only for the local origin check because Cloudflare Origin CA
certificates are not publicly trusted. If the origin returns JSON but the edge
returns HTML, inspect Cloudflare Workers, redirects, Access/challenge rules and
cache rules for `/api/*`. If the origin also returns HTML, inspect the running
proxy configuration and its `/api/` upstream. A `Location` header identifies a
redirect that the previous Node fetch would have followed. Keep the existing
volumes; deleting them cannot repair API routing and can destroy stored data.
