from datetime import timedelta
import hashlib
from pathlib import Path

import environ
from celery.schedules import crontab
from kombu import Queue

BASE_DIR = Path(__file__).resolve().parent.parent.parent
env = environ.Env()
environ.Env.read_env(BASE_DIR / ".env")

SECRET_KEY = env("DJANGO_SECRET_KEY")
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS", default=[])
CSRF_TRUSTED_ORIGINS = env.list("DJANGO_CSRF_TRUSTED_ORIGINS", default=[])

INSTALLED_APPS = [
    "daphne",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "channels",
    "storages",
    "common",
    "accounts",
    "brokers",
    "contactdesk",
    "places",
    "promotions",
    "semantic",
    "professionals",
    "services_catalog",
    "audit",
    "finance",
    "taxonomy",
    "listings",
    "analytics",
    "entitlements",
    "messaging",
    "notifications",
    "emailing",
    "platform_settings",
    "payments",
    "content",
    "staffops",
    "translation",
    "uitext",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "common.middleware.RequestIDMiddleware",
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

AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
        "OPTIONS": {"min_length": 10},
    },
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
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
CELERY_TASK_QUEUES = (
    Queue("default", routing_key="default"),
    Queue("notifications", routing_key="notifications"),
    Queue("media", routing_key="media"),
    Queue("maintenance", routing_key="maintenance"),
)
CELERY_TASK_ROUTES = {
    "common.tasks.flush_expired_tokens": {"queue": "maintenance"},
    "common.tasks.*": {"queue": "default"},
    "accounts.tasks.*": {"queue": "notifications"},
    "notifications.tasks.*": {"queue": "notifications"},
    "analytics.tasks.*": {"queue": "maintenance"},
    "listings.tasks.process_listing_media": {"queue": "media"},
    "listings.tasks.*": {"queue": "maintenance"},
    "entitlements.tasks.*": {"queue": "maintenance"},
}

# Spec §22.5's "daily task". Times are UTC and staggered so the expiry sweep
# finishes before the reminder pass reads `expires_at`.
CELERY_BEAT_SCHEDULE = {
    "expire-due-listings": {
        "task": "listings.tasks.expire_due_listings",
        "schedule": crontab(hour=3, minute=0),
    },
    "send-listing-expiry-reminders": {
        "task": "listings.tasks.send_listing_expiry_reminders",
        "schedule": crontab(hour=3, minute=15),
    },
    "cleanup-stale-media-uploads": {
        "task": "listings.tasks.cleanup_stale_media_uploads",
        "schedule": crontab(minute=10),
    },
    "translate-site-text": {
        "task": "uitext.tasks.translate_pending_ui_text",
        "schedule": crontab(minute="*/10"),
    },
    "sync-openrouter-models": {
        "task": "translation.tasks.sync_openrouter_models",
        "schedule": crontab(hour=4, minute=30),
    },
    "staff-moderation-digest": {
        "task": "listings.tasks.send_staff_moderation_digest",
        "schedule": crontab(hour=7, minute=0),
    },
    "lapse-unpaid-professional-memberships": {
        "task": "professionals.tasks.lapse_unpaid_memberships",
        "schedule": crontab(minute=5),
    },
    "sweep-entitlement-ledger": {
        "task": "entitlements.tasks.sweep_entitlement_ledger",
        "schedule": crontab(hour=3, minute=30),
    },
    "sync-places": {
        "task": "places.tasks.sync_places",
        "schedule": crontab(hour=2, minute=30, day_of_week="sunday"),
        "options": {"queue": "maintenance"},
    },
    "flush-expired-jwt-tokens": {
        "task": "common.tasks.flush_expired_tokens",
        "schedule": crontab(hour=3, minute=0),
        "options": {"queue": "maintenance"},
    },
}

# Markets brokers and professionals may register in.
SUPPORTED_COUNTRIES = env.list("SUPPORTED_COUNTRIES", default=["ES", "IT"])

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_THROTTLE_CLASSES": [
        "common.throttling.HashedIPScopedRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "taxonomy_search": "60/min",
        # Public listing reads (spec §30.1). Deliberately looser than
        # `taxonomy_search`: that bucket guards a type-ahead search box, where 60
        # requests a minute already exceeds any human typing session, while this
        # one guards ordinary page loads — a browse page plus its detail pages,
        # each with its own client-side prefetches, is a normal handful of
        # requests per view. 300/min leaves real browsing untouched while still
        # putting a ceiling on bulk scraping of the public catalogue.
        "public_listing_read": "300/min",
        "auth": "10/min",
        # Phase 22: previously unthrottled surfaces.
        "listing_workflow": "120/min",
        "account": "120/min",
        "broker_team": "120/min",
        "public_settings": "300/min",
        "public_content_read": "300/min",
        # Phase 15: applying a purchased media upgrade takes a row lock.
        "media_upgrade_apply": "30/hour",
        # Phase 15: upload intents and completions from the listing form.
        "media_upload": "600/hour",
        # Silent refresh runs on every fresh page load and requires an already-valid
        # HttpOnly cookie, so it is not a credential-guessing surface. Sharing the
        # stricter `auth` bucket would let a handful of reloads lock real people out
        # of logging in. Used by RefreshView only - see Task 10's SessionProvider.
        "auth-refresh": "30/min",
        "services_directory": "60/min",
        "inquiry_submit": "20/hour",
        "messaging_read": "120/min",
        # Phase 18: notification list/read; the bell polls on reconnect only.
        "notifications": "120/min",
        # Phase 17: staff console reads and ledger operations.
        "staff_moderation": "300/min",
        "translation": "30/hour",
        "translation_status": "120/min",
        "staff_entitlements": "120/min",
        "inquiry_draft": "30/hour",
        "message_send": "60/hour",
        # Phase 7, spec §30.4. Looser than `services_directory` because the
        # contact panel fetches once per profile view AND again after a
        # successful inquiry, on top of the page's own directory calls.
        "contact_access": "120/min",
        # Phase 7, spec §30.4. A staff remedy, used a handful of times a day.
        "contact_grant_admin": "30/min",
        # Spec 30.4 does not name inbox filing, but this is a write and it sits
        # on an authenticated screen a broker refreshes all day. Looser than
        # `message_send` because archiving reaches nobody and creates nothing;
        # tighter than `messaging_read` because it takes a row lock.
        "conversation_status": "120/hour",
        # Broker home is a screen a brokerage refreshes through the working day,
        # and every field is a live aggregate. Matches `taxonomy_search`'s order
        # of magnitude: well above a human's page loads, well below scripted
        # polling of another organization's counters.
        "broker_dashboard": "120/min",
        # Spec §30.4 lists finance quote logging among the rate-limited
        # surfaces while allowing "the calculation itself [to] remain
        # reasonably accessible". The finance page recalculates on every
        # assumption change and each boat card's details disclosure fires one
        # request when it is opened, so the bucket is well above a browsing
        # session and well below scripted enumeration of the catalogue.
        "finance_quote": "120/min",
        "checkout_create": "30/min",
        "contact_request": "10/hour",
        "promo_event": "1200/hour",
        # Eligibility is polled on every Sell/dashboard/create render (spec
        # §22.2 names five evaluation points), so it is sized like a page-load
        # endpoint rather than like the `auth` bucket. It is authenticated and
        # returns only the caller's own quota, so it is not a scraping surface.
        "listing_eligibility": "120/min",
        "listing_form_options": "120/min",
    },
    "EXCEPTION_HANDLER": "common.exceptions.nauta_exception_handler",
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(
        minutes=env.int("JWT_ACCESS_TOKEN_LIFETIME_MINUTES", default=15)
    ),
    "REFRESH_TOKEN_LIFETIME": timedelta(
        days=env.int("JWT_REFRESH_TOKEN_LIFETIME_DAYS", default=7)
    ),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
}

STORAGES = {
    "default": {
        "BACKEND": "storages.backends.s3.S3Storage",
    },
    "staticfiles": {
        "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
    },
}
AWS_ACCESS_KEY_ID = env("OBJECT_STORAGE_ACCESS_KEY", default=None)
AWS_SECRET_ACCESS_KEY = env("OBJECT_STORAGE_SECRET_KEY", default=None)
AWS_STORAGE_BUCKET_NAME = env("OBJECT_STORAGE_BUCKET_NAME")
AWS_S3_ENDPOINT_URL = env("OBJECT_STORAGE_ENDPOINT_URL", default=None) or None
AWS_S3_REGION_NAME = env("OBJECT_STORAGE_REGION", default="us-east-1")
AWS_S3_ADDRESSING_STYLE = "path" if AWS_S3_ENDPOINT_URL else "virtual"
AWS_S3_SIGNATURE_VERSION = "s3v4"
AWS_DEFAULT_ACL = None
AWS_QUERYSTRING_AUTH = True

# Public CDN origin in front of the media bucket; empty = not served yet.
MEDIA_PUBLIC_BASE_URL = env("MEDIA_PUBLIC_BASE_URL", default="")
# Private S3 downloads for approved public snapshots when no CDN is configured.
MEDIA_SIGNED_URLS = env.bool("MEDIA_SIGNED_URLS", default=False)
# Phase 15: re-encode uploaded images without metadata (EXIF/GPS/XMP).
# AI translation through OpenRouter. The key comes from the environment (server secret), never the database.
OPENROUTER_API_KEY = env("OPENROUTER_API_KEY", default="")
OPENROUTER_BASE_URL = env("OPENROUTER_BASE_URL", default="https://openrouter.ai/api/v1")
MEDIA_IMAGE_SANITIZER = "listings.media_sanitize.strip_image_metadata"
# Malware scanning is on whenever a clamd host is configured (spec 24.2 step 7).
CLAMAV_HOST = env("CLAMAV_HOST", default="")
CLAMAV_PORT = env.int("CLAMAV_PORT", default=3310)
MEDIA_SCANNER = "listings.media_scan.clamd_scan" if CLAMAV_HOST else None
# ffprobe video checks (spec 24.3); needs ffmpeg in the image.
MEDIA_VIDEO_INSPECTOR = (
    "listings.media_video.probe_video" if env.bool("MEDIA_VIDEO_PROBE", default=False) else None
)
STRIPE_SECRET_KEY = env("STRIPE_SECRET_KEY")
STRIPE_PUBLISHABLE_KEY = env("STRIPE_PUBLISHABLE_KEY")
STRIPE_WEBHOOK_SECRET = env("STRIPE_WEBHOOK_SECRET")

CONTACT_HASH_SECRET = env("CONTACT_HASH_SECRET")

# Shared secret proving a request genuinely originates from this project's own
# Next.js server (server-to-server, never exposed to the browser) rather than
# the public internet. See common.ip.get_client_ip.
INTERNAL_SERVICE_SECRET = env("INTERNAL_SERVICE_SECRET")

# Spec §11.7 / §30.4: "Proxy headers are trusted only from configured reverse
# proxies." The number of reverse proxies WE operate in front of Django. 0 means
# none, so `X-Forwarded-For` is ignored entirely and `REMOTE_ADDR` is the client
# — correct for the current deployment, where Django is reached directly. Set it
# to 1 behind a single nginx/CDN edge, 2 behind two, and so on. Read by
# common.ip.get_client_ip(); never infer it from request contents. Note this is
# independent of INTERNAL_SERVICE_SECRET above: that path authenticates our own
# Next.js hop, this one describes untrusted network proxies.
TRUSTED_PROXY_COUNT = env.int("TRUSTED_PROXY_COUNT", default=0)

# Optional IPv6 prefix truncation before an address becomes an identity. 0 = off,
# which is the shipped default and changes nothing. A single residential IPv6 /64
# is 2**64 usable addresses, so an untruncated hash lets one subscriber generate
# an unbounded number of apparently-unique viewers (and an unbounded number of
# throttle buckets). Setting this to 64 collapses each /64 into one identity, at
# the cost of merging everyone behind that prefix. Off by default because the
# right value depends on real traffic; see Known Limitation 13 in the Phase 10
# plan. IPv4 is never truncated. Read by common.ip.get_client_ip().
IPV6_HASH_PREFIX_BITS = env.int("IPV6_HASH_PREFIX_BITS", default=0)

PUBLIC_BASE_URL = env("PUBLIC_BASE_URL")

# Secure-by-default: only the dev settings module opts out, and it does so out loud.
REFRESH_COOKIE_SECURE = env.bool("REFRESH_COOKIE_SECURE", default=True)

# The frontend is a separate origin from this API (no reverse proxy unifies them -
# see docker-compose.yml) and it calls us with `credentials: "include"`, so every
# login/refresh/session/logout call is a credentialed cross-origin request. Without
# both of these the browser blocks the response and the client sees an opaque
# network error. Empty by default so a misconfigured deployment fails closed and
# loudly rather than silently allowing an origin nobody intended; dev.py pins its
# own localhost list instead of reading the environment.
CORS_ALLOWED_ORIGINS = env.list("DJANGO_CORS_ALLOWED_ORIGINS", default=[])
CORS_ALLOW_CREDENTIALS = True

EMAIL_BACKEND = env("EMAIL_BACKEND")
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL")
# Where every public form (contact page, financing study) is announced to the team.
CONTACT_NOTIFY_EMAIL = env("CONTACT_NOTIFY_EMAIL", default="info@nautelo.com")

# ZeptoMail (emailing.backend.ZeptoMailBackend): point EMAIL_BACKEND at that
# class to send through it. Empty by default so a deployment that hasn't set
# up ZeptoMail yet fails loudly at send time rather than silently dropping mail.
ZEPTOMAIL_API_KEY = env("ZEPTOMAIL_API_KEY", default="")
ZEPTOMAIL_API_URL = env("ZEPTOMAIL_API_URL", default="https://api.zeptomail.eu/v1.1/email")

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# Natural-language boat search: open-source multilingual embeddings running on the CPU (see docs/semantic-search.md).
SEMANTIC_EMBEDDER = env("SEMANTIC_EMBEDDER", default="fastembed")  # "hash" keeps tests offline
SEMANTIC_MODEL = env("SEMANTIC_MODEL", default="sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")
SEMANTIC_CACHE_DIR = env("SEMANTIC_CACHE_DIR", default="")

# Site text (every word of the interface, editable in the admin). The English source is one JSON file in the frontend repo;
# the Docker image carries a copy next to manage.py.
_UITEXT_IMAGE_COPY = BASE_DIR / "ui_source.en.json"
UITEXT_SOURCE_FILE = _UITEXT_IMAGE_COPY if _UITEXT_IMAGE_COPY.exists() else BASE_DIR.parent / "frontend" / "src" / "i18n" / "source.en.json"
_UITEXT_SEED_COPY = BASE_DIR / "ui_seed.json"
UITEXT_SEED_FILE = _UITEXT_SEED_COPY if _UITEXT_SEED_COPY.exists() else BASE_DIR.parent / "frontend" / "src" / "i18n" / "seed.json"
# Publishing tells the site to drop its cached text right away (optional; the site's own cache also expires in a minute).
# The token is derived from the secret both sides already share, so no new secret has to be set anywhere.
UITEXT_REVALIDATE_URL = env("UITEXT_REVALIDATE_URL", default="http://web:3000/api/revalidate-ui-text/" if env("DEPLOY_ENVIRONMENT", default="") else "")
UITEXT_REVALIDATE_TOKEN = hashlib.sha256(f"uitext:{INTERNAL_SERVICE_SECRET}".encode()).hexdigest()
