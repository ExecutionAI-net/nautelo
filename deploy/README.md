# Nautelo on one EC2 instance

Two independent Compose projects run behind one shared Nginx container. Region: **eu-west-1**. Replace the example domains everywhere before deployment.

| Environment | Source branch | Frontend | API | Image tag |
|---|---|---|---|---|
| dev | `dev` | `dev.example.com` | `api.dev.example.com` | `GITHUB_RUN_NUMBER` |
| prod | `main` | `example.com` | `api.example.com` | `GITHUB_RUN_NUMBER` |

Image references use these four ECR repositories:

```text
790702264138.dkr.ecr.eu-west-1.amazonaws.com/nautelo/frontend/dev:GITHUB_RUN_NUMBER
790702264138.dkr.ecr.eu-west-1.amazonaws.com/nautelo/backend/dev:GITHUB_RUN_NUMBER
790702264138.dkr.ecr.eu-west-1.amazonaws.com/nautelo/frontend/prod:GITHUB_RUN_NUMBER
790702264138.dkr.ecr.eu-west-1.amazonaws.com/nautelo/backend/prod:GITHUB_RUN_NUMBER
```

`GITHUB_RUN_NUMBER` is replaced with the workflow's numeric run number, for example `42`. The HTTPS configuration uses hardened Django production settings; the dev environment is a deployed test environment. The root `docker-compose.yml` remains the local Postgres/Redis/MinIO setup.

Each environment has its own Postgres, Redis, Celery worker, Celery beat, frontend, API, volumes, Secrets Manager secret, and S3 bucket. Only Nginx publishes host ports (80 and 443). API and frontend join their environment's proxy network. Databases and Redis stay on their environment's default network. The worker consumes all four queues, including notifications.

## Current rollout: dev only on the EC2 public IP

For the initial test, use **http://108.130.226.143**. The API is at **http://108.130.226.143/api/v1/** on the same port. Nginx routes `/api/`, `/ws/`, `/admin/`, and Django `/static/` assets to the backend; other requests go to the frontend. Only host port **80** is published by this temporary proxy. Your existing security group ports 80, 443, and 22 are sufficient. Keep database, Redis, 3000, 8000, and 8080 closed.

Update these three keys in the existing **`nautelo/dev`** Secrets Manager JSON, keeping all other required keys:

```json
{
  "DEPLOY_ALLOW_HTTP": "true",
  "NEXT_PUBLIC_BASE_URL": "http://108.130.226.143",
  "NEXT_PUBLIC_API_BASE_URL": "http://108.130.226.143"
}
```

This is a partial update example, not a replacement for the complete secret. Prod must keep HTTPS URLs and omit `DEPLOY_ALLOW_HTTP` (or set it to `false`). The deployment script rejects HTTP mode for prod. Dev HTTP keeps `DEBUG=False` and explicit allowed hosts, while disabling SSL redirects, HSTS, and secure-only cookies for this test. HTTP does not encrypt logins or session traffic; use test accounts and data.

Apply the dev bucket CORS origin using AWS credentials with `s3:PutBucketCORS` (an AWS administration session or the S3 console; this configuration permission is not required on the application role):

```bash
aws s3api put-bucket-cors --region eu-west-1 --bucket nautelo-dev \
  --cors-configuration '{"CORSRules":[{"AllowedOrigins":["http://108.130.226.143"],"AllowedMethods":["GET","PUT","HEAD"],"AllowedHeaders":["*"],"ExposeHeaders":["ETag"],"MaxAgeSeconds":3600}]}'
```

Set `EC2_INSTANCE_ID=i-0a628b595b9e8d709` in the GitHub dev environment along with the OIDC role variable. Push `devops` and merge it into `dev` when ready. CI builds the dev images with these public URLs, then SSM deploys the app and automatically starts the temporary dev HTTP proxy. No certificates, domains, prod secret lookup, prod network, or manual proxy bootstrap is needed for this mode. Leave `main` unchanged until you are ready for prod. Port 80 must be free of any existing host Nginx/Apache or HTTPS proxy before the first deployment.

After the workflow succeeds:

```bash
curl --fail http://108.130.226.143/api/v1/health/
curl --fail http://108.130.226.143/login/
```

Check login/refresh, a photo/video upload, and signed S3 downloads in your browser. WebSocket connections use `ws://108.130.226.143/ws/...`. If the IP changes, update both public URLs, bucket CORS, and rebuild/redeploy.

When moving to domains, set the dev URLs to the distinct HTTPS frontend/API origins, remove the HTTP opt-in, update S3 CORS, obtain the certificate, and bootstrap the shared HTTPS proxy as described below. Stop the temporary proxy first to release port 80:

```bash
sudo docker ps --filter label=com.docker.compose.project=nautelo-dev-http-proxy
# In the last successful dev release directory:
sudo env DEV_HTTP_HOST=108.130.226.143 docker compose -f deploy/docker-compose.proxy.dev-http.yml down
```

Do not use `down -v`; the static volume is shared with the dev application. HTTP-to-HTTPS migration should be a planned cutover. Normal HTTPS deployments do not automatically delete or replace the temporary proxy.

## 1. Prepare AWS and EC2

Use a Linux **x86_64** EC2 instance (the GitHub build runner builds amd64 images), an encrypted persistent EBS volume, and an Elastic IP. Install Docker Engine, Docker Compose **2.30+**, Python 3, AWS CLI v2, Git, and Certbot. The deployment account must be able to use Docker. Size RAM/CPU for two copies of the app, two databases, and four Celery worker processes; monitor memory and disk before adding traffic. Building images in CI avoids EC2 build load.

Allow inbound TCP 80 and 443; restrict SSH to your administration IP or use SSM. Do not open PostgreSQL, Redis, 3000, or 8000. Point all four DNS A records at the Elastic IP. Use the domains directly; adding a CDN proxy changes the trusted client-IP configuration.

All four ECR repository paths above have been confirmed, including `790702264138.dkr.ecr.eu-west-1.amazonaws.com/nautelo/frontend/dev`. The creation commands below are reference only; do not recreate existing repositories:

```bash
aws ecr create-repository --region eu-west-1 --repository-name nautelo/backend/dev --image-tag-mutability IMMUTABLE
aws ecr create-repository --region eu-west-1 --repository-name nautelo/frontend/dev --image-tag-mutability IMMUTABLE
aws ecr create-repository --region eu-west-1 --repository-name nautelo/backend/prod --image-tag-mutability IMMUTABLE
aws ecr create-repository --region eu-west-1 --repository-name nautelo/frontend/prod --image-tag-mutability IMMUTABLE
```

Keep your existing EC2 IAM role with Secrets Manager, S3, and ECR permissions. `aws/ec2-policy.example.json` is a reference to compare resource scope with your account `790702264138` and your confirmed buckets `nautelo-dev` / `nautelo-prod`; do not create a duplicate role. The role needs Secrets Manager read, ECR pull, and object access to the two buckets. If using a customer-managed KMS key, also grant the appropriate KMS permissions and key-policy access. Require IMDSv2 and set the response hop limit to **2**, so container SDKs can retrieve rotating role credentials:

```bash
aws ec2 modify-instance-metadata-options --region eu-west-1 --instance-id i-REPLACE \
  --http-tokens required --http-put-response-hop-limit 2 --http-endpoint enabled
```

Do not put AWS access keys in Secrets Manager or Compose. The instance role supplies S3 credentials. These environments share a host and its IAM role: Docker network separation is not a security boundary against a compromised host/container with role access. Use separate instances/roles if dev must be unable to access prod AWS resources.

## 2. Configure the existing private S3 buckets

Use the existing buckets directly; no CloudFront distribution is needed. Set these values in each Secrets Manager JSON:

| Secret | `OBJECT_STORAGE_BUCKET_NAME` | `OBJECT_STORAGE_REGION` |
|---|---|---|
| `nautelo/dev` | `nautelo-dev` | `eu-west-1` |
| `nautelo/prod` | `nautelo-prod` | `eu-west-1` |

The secret example uses the dev bucket. Change it to `nautelo-prod` when preparing the prod secret. The application reads this setting from Secrets Manager at deployment. The EC2 IAM policy example covers these exact buckets and their objects.

Apply or verify the following configuration on the existing dev bucket:

```bash
aws s3api put-public-access-block --region eu-west-1 --bucket nautelo-dev \
  --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
aws s3api put-bucket-versioning --region eu-west-1 --bucket nautelo-dev \
  --versioning-configuration Status=Enabled
aws s3api put-bucket-cors --region eu-west-1 --bucket nautelo-dev \
  --cors-configuration file://deploy/aws/s3-cors.dev.json
```

Repeat for bucket `nautelo-prod` using `s3-cors.prod.json`. Replace CORS origins with the actual frontend origins. Keep default encryption enabled; configure lifecycle retention for noncurrent versions to control storage usage. Do not delete active media by age.

The existing upload-intent API gives the browser a presigned PUT URL. Photo/video bytes go directly to S3, avoiding Nginx's 5 MB API request limit. Workers validate uploads and sanitize images. The deployment enables `MEDIA_SIGNED_URLS`, which adds expiring signed GET URLs to approved public snapshot media; unsigned bucket access stays blocked. URLs expire (django-storages defaults to one hour), so long-lived browser pages must refetch listing data when needed. Existing video validation/processing behavior is unchanged; this setup does not add transcoding.

The deployment helper explicitly sets `MEDIA_PUBLIC_BASE_URL` to an empty string and `MEDIA_SIGNED_URLS=True`, so delivery is directly from private S3 even if an old CDN value remains in a secret. CloudFront is not used. When adding a CDN later, update this override along with the origin-access and publication policy; do not make the upload bucket public.

## 3. Store environment configuration in Secrets Manager

Your existing secrets are `nautelo/dev` and `nautelo/prod` in account `790702264138`, region `eu-west-1`. The workflow defaults to these names. The ARNs supplied without the generated suffix are partial ARNs; using the secret names avoids ambiguity. IAM examples match the six-character suffix with `??????`.

Copy `deploy/secret.example.json` to an ignored `deploy/secret.dev.json`, fill in every value, and store **one JSON SecretString per environment** in those existing secrets. Use independent random Django, contact-hash, internal-service, and database secrets. Use Stripe test credentials in dev and live credentials in prod. Set the two HTTPS URLs, bucket, region, and email settings for each environment.

```bash
aws secretsmanager put-secret-value --region eu-west-1 --secret-id nautelo/dev \
  --secret-string file://deploy/secret.dev.json
aws secretsmanager put-secret-value --region eu-west-1 --secret-id nautelo/prod \
  --secret-string file://deploy/secret.prod.json
```

Remove local input copies after confirming the secrets exist. To change a secret use `put-secret-value` with the same file input. Values must be single-line strings. Dollars, quotes, spaces, and `#` are preserved. Do not include `AWS_*`, `OBJECT_STORAGE_ACCESS_KEY`, `OBJECT_STORAGE_SECRET_KEY`, or `OBJECT_STORAGE_ENDPOINT_URL`: S3 uses the EC2 role and AWS endpoints.

The helper derives internal DB/Redis URLs, allowed hosts, CORS/CSRF origins, and secure-cookie settings. The PostgreSQL password is URL-encoded for Django. The frontend receives only its public URLs and `INTERNAL_SERVICE_SECRET`; Postgres receives only its DB/user/password. Console email in the example is for initial testing; configure and validate a supported mail backend before production email flows.

Secrets are fetched during deployment and written atomically into ignored `deploy/runtime/dev/` or `prod/` directories (directory mode 0700, files 0600). They remain on EC2 for container recreation and operational commands. Docker administrators can inspect container environments. Secrets are never used as Docker build arguments; only the two `NEXT_PUBLIC_*` URLs are supplied to the frontend build. Rotating runtime secrets requires redeployment. Changing public URLs requires rebuilding the frontend with a new tag as Next.js embeds them at build time.

Changing `POSTGRES_PASSWORD` in Secrets Manager does **not** change an existing database role password. Coordinate `ALTER ROLE` and secret rotation during maintenance; do not delete the database volume.

## 4. Build tagged images from branches

Create GitHub environments `dev` and `prod`, restricting their deployment branches to `dev` and `main` respectively. Configure these environment variables:

- `AWS_BUILD_ROLE_ARN`: the OIDC role to assume for that environment.
- `ECR_REGISTRY` (optional override): defaults to `790702264138.dkr.ecr.eu-west-1.amazonaws.com`.
- `AWS_SECRET_ID` (optional override): defaults to `nautelo/dev` or `nautelo/prod` based on the branch.
- `EC2_INSTANCE_ID`: your instance ID, identical in both environments because both run on the same EC2.

Create the GitHub OIDC provider and role using `aws/github-trust.example.json`. Account `790702264138` is already set; substitute OWNER/REPO; use `environment:prod` for the prod role. Attach `aws/build-policy.example.json`, restricting the Secrets Manager resource to the role's own environment. Also attach `aws/ssm-deploy-policy.example.json`, replacing `i-REPLACE` with your one target instance. The GitHub role can push images, read configuration, send `AWS-RunShellScript` commands to that instance, and read command status. It does not need S3 access. SSM shell commands execute as root: both GitHub environment roles therefore have administrative access to the shared host; environment rules do not isolate them at the OS level. Set production environment protection/branch rules as needed. The build role reads the secret to obtain public build URLs; the script never prints the secret payload.

`.github/workflows/images.yml` runs on pushes to `dev` and `main` and can be manually dispatched on either branch. It first calls the reusable CI workflow (backend tests, frontend checks/build, and deployment configuration validation). Only after CI succeeds does it build/push both images and deploy through SSM. Pull requests run CI without deployment.

Tags are exactly `GITHUB_RUN_NUMBER`; the environment is part of the repository name. Re-running the same workflow run keeps its run number, so it cannot overwrite an image already published to an immutable ECR repository. To rebuild, dispatch a new workflow run; to retry only deployment, use the existing numeric tag with `ssm_deploy.py`. The SSM helper sends the matching deployment files and public configuration inline in a compressed payload; it sends no secret values, source checkout, GitHub token, or AWS keys. EC2 installs the files under `/opt/nautelo/releases/ENV/TAG/`, fetches runtime secrets using its own role, pulls images, runs migrations, and checks health. No GitHub authentication, Git fetch, SSH key, or inbound SSH port is needed on EC2.

The job prints the SSM command ID, polls for completion, and fails on command failure or timeout. It deliberately does not echo remote output into GitHub logs; inspect Run Command output in Systems Manager when troubleshooting. A cancelled GitHub run does not cancel an already-sent remote command: check its status before retrying. Per-environment locks also serialize remote deployments. The last successful release path is recorded in `/opt/nautelo/deploy/runtime/ENV/last-successful-release`.

For a local build, copy `config.dev.example.json` to `config.dev.json`, authenticate AWS CLI with a permitted role, and run from the appropriate branch:

```bash
python3 deploy/manage.py build dev 42
# From main:
python3 deploy/manage.py build prod 43
```

Use the numeric run number assigned to the release; avoid manually publishing tags that a future workflow run could need. Build from clean checkouts and record the source commit alongside any manual build. The helper checks the selected branch. Both Dockerfiles use the repository root as build context, and `.dockerignore` excludes secrets, local environments, and build artifacts.

## 5. Enable SSM on the existing instance

Attach **AmazonSSMManagedInstanceCore** to your existing EC2 role if it is not already attached. Install/start the SSM Agent and verify the instance is **Online** in Systems Manager in `eu-west-1`. The instance needs outbound HTTPS access to Systems Manager/SSM Messages, ECR, Secrets Manager, and S3 through internet/NAT or the appropriate VPC endpoints. No inbound SSM port is needed.

Keep Python 3, Docker, Compose 2.30+, AWS CLI v2, certificates, and the shared Nginx proxy installed on the host. SSM runs the deployment as root, and owns `/opt/nautelo/releases` and `/opt/nautelo/deploy/runtime`; use `sudo` for manual operational commands that read those runtime files. For HTTPS, the shared Nginx proxy is bootstrapped once using the next section and is not recreated by each app deployment. Dev HTTP mode instead automatically starts its own temporary proxy.

## 6. Start the shared HTTPS proxy

Copy the shared proxy files (`docker-compose.proxy.yml`, `nginx.conf`, and `proxy.env.example`) into `/opt/nautelo/deploy` once. You can also bootstrap from a repository checkout there, but ongoing deployments do not need one. Run the following commands from `/opt/nautelo`. Copy `deploy/proxy.env.example` to `deploy/proxy.env` and replace the four domains. Create the two proxy networks (once):

```bash
docker network create nautelo-dev-edge
docker network create nautelo-prod-edge
mkdir -p deploy/acme
```

Before starting Nginx, issue a single certificate covering all four names. Port 80 must be free for initial standalone issuance; replace the names below:

```bash
sudo certbot certonly --standalone --cert-name nautelo \
  -d dev.example.com -d api.dev.example.com -d example.com -d api.example.com

docker compose --env-file deploy/proxy.env -f deploy/docker-compose.proxy.yml up -d
docker compose --env-file deploy/proxy.env -f deploy/docker-compose.proxy.yml exec nginx nginx -t
```

Nginx can start while either app stack is absent; it dynamically resolves each environment's Docker alias. Requests to an absent stack return 502 without taking down the other environment. The shared certificate is expected at `/etc/letsencrypt/live/nautelo/`.

After issuance, configure renewals to use the shared webroot (substitute the actual checkout path):

```bash
sudo certbot reconfigure --cert-name nautelo --webroot --webroot-path /opt/nautelo/deploy/acme
sudo certbot renew --dry-run
```

Install a root-owned executable deploy hook under `/etc/letsencrypt/renewal-hooks/deploy/` containing:

```sh
#!/bin/sh
cd /opt/nautelo || exit 1
docker compose --env-file deploy/proxy.env -f deploy/docker-compose.proxy.yml exec -T nginx nginx -s reload
```

Enable the OS-provided Certbot renewal timer and verify it runs. Older Certbot releases without `reconfigure` need their renewal configuration updated using the release's supported workflow.

## 7. Deploy dev and prod independently

With GitHub variables, OIDC policies, SSM, and the shared proxy configured, push to `dev` for dev or `main` for prod. The workflow handles the deployment automatically after CI passes. No environment config files need to be manually copied to EC2 for this path.

For a manual deployment from a local checkout with AWS SSM permissions, copy the matching config example, fill in the account/secret details, and use an existing published tag:

```bash
python3 deploy/ssm_deploy.py dev 42 --instance-id i-REPLACE
python3 deploy/ssm_deploy.py prod 43 --instance-id i-REPLACE
```

The local `manage.py deploy` command remains available when running directly on EC2 from a release directory. To inspect the active dev deployment from the host:

```bash
sudo sh -c 'cd "$(cat /opt/nautelo/deploy/runtime/dev/last-successful-release)" && docker compose --env-file /opt/nautelo/deploy/runtime/dev/compose.env -f deploy/docker-compose.dev.yml ps'
```

Keep old release directories while their runtime Compose references or rollback procedures need them. Do not delete the shared runtime directory during release cleanup.

The helper authenticates to ECR, fetches configuration, pulls images, waits for Postgres/Redis, runs migrations plus `collectstatic`, then recreates the four app services and waits for API/frontend health. A migration failure stops before app replacement. It locks per environment to prevent overlapping deployments. Static assets for Django admin are served by Nginx from separate named volumes. The frontend image serves its own assets.

This is a single-host Compose rollout with a brief interruption, not a zero-downtime deployment. Existing workers/API can still run while migrations execute: use backward-compatible schema migrations, or stop that environment's app services for a planned maintenance migration. A failed health check is reported and does not automatically roll back. Inspect logs and deploy a known-good compatible tag. Database migrations are not reversed by image rollback.

Verify after each deployment:

```bash
curl --fail https://api.dev.example.com/api/v1/health/
curl --fail https://api.example.com/api/v1/health/
# Logs on EC2 for the last successful dev release:
sudo sh -c 'cd "$(cat /opt/nautelo/deploy/runtime/dev/last-successful-release)" && docker compose --env-file /opt/nautelo/deploy/runtime/dev/compose.env -f deploy/docker-compose.dev.yml logs --tail=100 api worker web'
```

Also exercise login/refresh, notifications over WebSocket, Django admin styles, and one photo and video upload/completion/download in each environment. Confirm dev records and uploads do not appear in prod. Set up database backups and test restores, monitor disk/memory and certificate expiry, and retain prior ECR tags for rollback. Never use `docker compose down -v` on these stacks unless intentionally destroying their data.

## Validation and references

Run helper tests with `python3 -m unittest discover -s deploy/tests -v`. On a Docker-capable host, render each stack with the generated `compose.env` using `docker compose ... config --quiet`; avoid printing `config` output because it includes secret values.

- [Compose raw env files](https://docs.docker.com/compose/how-tos/environment-variables/set-environment-variables/) require Compose 2.30+.
- [EC2 metadata in containers](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/instancedata-data-retrieval.html) explains the IMDS response hop limit.
- [django-storages S3 authentication and signed URLs](https://django-storages.readthedocs.io/en/latest/backends/amazon-S3.html).
- [Certbot renewal configuration](https://eff-certbot.readthedocs.io/en/latest/using.html).
- [S3 CORS configuration](https://docs.aws.amazon.com/AmazonS3/latest/userguide/ManageCorsUsing.html).

- [Systems Manager instance permissions](https://docs.aws.amazon.com/systems-manager/latest/userguide/setup-instance-permissions.html).
- [Run Command IAM setup](https://docs.aws.amazon.com/systems-manager/latest/userguide/run-command-setting-up.html).

- [Secrets Manager accepts secret names or ARNs](https://docs.aws.amazon.com/secretsmanager/latest/apireference/API_GetSecretValue.html); [ARN suffix matching in IAM](https://docs.aws.amazon.com/secretsmanager/latest/userguide/auth-and-access_iam-policies.html).

- [Nginx proxy Host headers](https://nginx.org/en/docs/http/ngx_http_proxy_module.html).
