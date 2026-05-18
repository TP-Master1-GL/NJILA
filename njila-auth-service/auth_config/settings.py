from decouple import config as env
from datetime import timedelta
from pathlib import Path
import os

from auth_config.cloud import fetch_remote_config
_remote = fetch_remote_config()


def _get(remote_key, local_key, cast=str, default=None):
    value = _remote.get(remote_key)
    if value is not None:
        try:
            return cast(value)
        except (ValueError, TypeError):
            pass
    return env(local_key, default=default, cast=cast)


SERVER_PORT = _get("server.port", "PORT", cast=int, default=8081)

BASE_DIR      = Path(__file__).resolve().parent.parent
SECRET_KEY    = env("NJILA_JWT_SECRET", default="njila-secret-key-2026-change-in-production")
DEBUG         = env("DEBUG", cast=bool, default=True)
ALLOWED_HOSTS = ["*"]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "drf_spectacular",
    "authentication",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF     = "auth_config.urls"
WSGI_APPLICATION = "auth_config.wsgi.application"

TEMPLATES = [{
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
}]


# ─────────────────────────────────────────────────────────────────────────────
# DATABASE — ✅ CORRIGÉ : connexions persistantes + pool
# ─────────────────────────────────────────────────────────────────────────────
DATABASES = {
    "default": {
        "ENGINE":   "django.db.backends.postgresql",
        "NAME":     _get("db.name",     "DB_NAME",     default="njila-auth-db"),
        "USER":     _get("db.user",     "DB_USER",     default="njila"),
        "PASSWORD": _get("db.password", "DB_PASSWORD", default="njila2026"),
        "HOST":     _get("db.host",     "DB_HOST",     default="localhost"),
        "PORT":     _get("db.port",     "DB_PORT",     default=5432),

        # ✅ AJOUT : Connexions persistantes (évite open/close à chaque requête)
        # CONN_MAX_AGE=0  → nouvelle connexion par requête (défaut Django, LENT)
        # CONN_MAX_AGE=60 → connexion réutilisée 60s (RAPIDE)
        "CONN_MAX_AGE": int(os.getenv("DB_CONN_MAX_AGE", "60")),

        # ✅ AJOUT : Health check avant de réutiliser une connexion (évite les
        # erreurs "connection closed" après idle)
        "CONN_HEALTH_CHECKS": True,

        "OPTIONS": {
            # ✅ AJOUT : timeout de connexion
            "connect_timeout": 10,
        },
    }
}

# ─────────────────────────────────────────────────────────────────────────────
# REDIS CACHE — ✅ CORRIGÉ : pool de connexions Redis optimisé
# ─────────────────────────────────────────────────────────────────────────────
_redis_host = _get("redis.host", "REDIS_HOST", default="njila-redis")
_redis_port = _get("redis.port", "REDIS_PORT", cast=int, default=6379)

CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": f"redis://{_redis_host}:{_redis_port}/0",
        "OPTIONS": {
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
            # ✅ AJOUT : pool de connexions Redis
            "CONNECTION_POOL_KWARGS": {
                "max_connections": 50,      # max connexions simultanées vers Redis
                "retry_on_timeout": True,
            },
            # ✅ AJOUT : socket timeouts pour ne pas bloquer les workers
            "SOCKET_CONNECT_TIMEOUT": 2,    # 2s pour établir la connexion
            "SOCKET_TIMEOUT": 2,            # 2s pour les opérations read/write
            # ✅ AJOUT : compresser les valeurs > 1KB (profils JSON)
            "COMPRESSOR": "django_redis.compressors.zlib.ZlibCompressor",
            "IGNORE_EXCEPTIONS": True,      # si Redis tombe, ne pas crasher le service
        },
        # ✅ AJOUT : TTL par défaut pour cache.set() sans timeout explicite
        "TIMEOUT": 300,  # 5 minutes
    }
}

# ─────────────────────────────────────────────────────────────────────────────
# RABBITMQ
# ─────────────────────────────────────────────────────────────────────────────
RABBITMQ_HOST  = _get("rabbitmq.host",  "RABBITMQ_HOST",  default="njila-rabbitmq")
RABBITMQ_PORT  = _get("rabbitmq.port",  "RABBITMQ_PORT",  cast=int, default=5672)
RABBITMQ_USER  = _get("rabbitmq.user",  "RABBITMQ_USER",  default="guest")
RABBITMQ_PASS  = _get("rabbitmq.pass",  "RABBITMQ_PASS",  default="guest")
RABBITMQ_VHOST = _get("rabbitmq.vhost", "RABBITMQ_VHOST", default="/")

RABBITMQ_EXCHANGE_USER         = "njila.user.exchange"
RABBITMQ_EXCHANGE_NOTIFICATION = "njila.notification.exchange"
RABBITMQ_EXCHANGE_SUBSCRIBE    = "njila.subscribe.exchange"
RABBITMQ_EXCHANGE_DEAD_LETTER  = "njila.dead.letter.exchange"

INTERNAL_SERVICE_TOKEN = os.getenv('INTERNAL_SERVICE_TOKEN', 'njila-shared-secret-2026')


REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "authentication.middleware.auth_middleware.NjilaJWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "authentication.middleware.auth_middleware.IsAuthenticated",
    ),
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
}

SPECTACULAR_SETTINGS = {
    "TITLE": "Njila Auth API",
    "DESCRIPTION": "Service d'authentification de la plateforme Njila",
    "VERSION": "1.3.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "SECURITY": [],
    "SECURITY_REQUIREMENTS": [],
    "COMPONENTS": {
        "securitySchemes": {
            "BearerAuth": {
                "type": "http",
                "scheme": "bearer",
                "bearerFormat": "JWT",
                "description": "Entrez votre access token JWT",
            },
            "InternalServiceToken": {
                "type": "apiKey",
                "in": "header",
                "name": "X-Internal-Token",
                "description": "Token secret pour les appels inter-services",
            },
        }
    },
    "SWAGGER_UI_SETTINGS": {
        "persistAuthorization": True,
        "displayRequestDuration": True,
    },
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(
        minutes=_get("jwt.access.minutes", "JWT_ACCESS_TOKEN_LIFETIME_MINUTES",
                     cast=int, default=200)
    ),
    "REFRESH_TOKEN_LIFETIME": timedelta(
        days=_get("jwt.refresh.days", "JWT_REFRESH_TOKEN_LIFETIME_DAYS",
                  cast=int, default=7)
    ),
    "ROTATE_REFRESH_TOKENS":    True,
    "BLACKLIST_AFTER_ROTATION": True,
    "ALGORITHM":                "HS256",
    "SIGNING_KEY":              SECRET_KEY,
    "AUTH_HEADER_TYPES":        ("Bearer",),
}

AUTH_USER_MODEL    = "authentication.NjilaUser"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
STATIC_URL         = "/static/"

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "[{asctime}] [{levelname}] [{name}] — {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": "INFO",
    },
    "loggers": {
        "authentication": {
            "handlers": ["console"],
            "level": "DEBUG",
            "propagate": False,
        },
        "pika":           {"handlers": ["console"], "level": "WARNING", "propagate": False},
        "pika.heartbeat": {"handlers": ["console"], "level": "WARNING", "propagate": False},
        "httpcore":       {"handlers": ["console"], "level": "WARNING", "propagate": False},
        "httpx":          {"handlers": ["console"], "level": "WARNING", "propagate": False},
        "asyncio":        {"handlers": ["console"], "level": "WARNING", "propagate": False},
    },
}