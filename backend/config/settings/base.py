from datetime import timedelta
from pathlib import Path

import environ
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
    "professionals",
    "services_catalog",
    "audit",
    "finance",
    "taxonomy",
    "listings",
    "analytics",
    "entitlements",
    "messaging",
    "platform_settings",
    "payments",
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
    "common.tasks.*": {"queue": "default"},
    "accounts.tasks.*": {"queue": "notifications"},
}

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
        # Silent refresh runs on every fresh page load and requires an already-valid
        # HttpOnly cookie, so it is not a credential-guessing surface. Sharing the
        # stricter `auth` bucket would let a handful of reloads lock real people out
        # of logging in. Used by RefreshView only - see Task 10's SessionProvider.
        "auth-refresh": "30/min",
        "services_directory": "60/min",
        # Spec §30.4 lists finance quote logging among the rate-limited
        # surfaces while allowing "the calculation itself [to] remain
        # reasonably accessible". The finance page recalculates on every
        # assumption change and each boat card's details disclosure fires one
        # request when it is opened, so the bucket is well above a browsing
        # session and well below scripted enumeration of the catalogue.
        "finance_quote": "120/min",
        # Eligibility is polled on every Sell/dashboard/create render (spec
        # §22.2 names five evaluation points), so it is sized like a page-load
        # endpoint rather than like the `auth` bucket. It is authenticated and
        # returns only the caller's own quota, so it is not a scraping surface.
        "listing_eligibility": "120/min",
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

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True
STATIC_URL = "static/"
