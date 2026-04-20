
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
SECRET_KEY    = env("SECRET_KEY", default="njila-2026-change-in-production")
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
    "corsheaders",
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

DATABASES = {
    "default": {
        "ENGINE":   "django.db.backends.postgresql",
        "NAME":     _get("db.name",     "DB_NAME",     default="njila-auth-db"),
        "USER":     _get("db.user",     "DB_USER",     default="njila"),
        "PASSWORD": _get("db.password", "DB_PASSWORD", default="njila2026"),
        "HOST":     _get("db.host",     "DB_HOST",     default="localhost"),
        "PORT":     5432,  # Valeur directe
    }
}

# DATABASES = {
#     "default": {
#         "ENGINE":   "django.db.backends.postgresql",
#         "NAME":     _get("db.name",     "DB_NAME",     default="njila-auth-db"),
#         "USER":     _get("db.user",     "DB_USER",     default="njila"),
#         "PASSWORD": _get("db.password", "DB_PASSWORD", default="njila2026"),
#         "HOST":     _get("db.host",     "DB_HOST",     default="localhost"),
#         "PORT":     5432,  # Valeur directe
#     }
# }

DATABASES = {
    "default": {
        "ENGINE":   "django.db.backends.postgresql",
        "NAME":     _get("db.name",     "DB_NAME",     default="njila-auth-db"),
        "USER":     _get("db.user",     "DB_USER",     default="njila"),
        "PASSWORD": _get("db.password", "DB_PASSWORD", default="njila2026"),
        "HOST":     _get("db.host",     "DB_HOST",     default="localhost"),
        "PORT":     _get("db.port",     "DB_PORT",     default=5432),
    }
}

_redis_host = _get("redis.host", "REDIS_HOST", default="localhost")
_redis_port = _get("redis.port", "REDIS_PORT", cast=int, default=6379)

CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": f"redis://{_redis_host}:{_redis_port}/0",
        "OPTIONS": {
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
        },
    }
}

RABBITMQ_HOST  = _get("rabbitmq.host",  "RABBITMQ_HOST",  default="njila-rabbitmq")
RABBITMQ_PORT  = _get("rabbitmq.port",  "RABBITMQ_PORT",  cast=int, default=5672)
RABBITMQ_USER  = _get("rabbitmq.user",  "RABBITMQ_USER",  default="guest")
RABBITMQ_PASS  = _get("rabbitmq.pass",  "RABBITMQ_PASS",  default="guest")
RABBITMQ_VHOST = _get("rabbitmq.vhost", "RABBITMQ_VHOST", default="/")

# ── Exchanges — un par service destinataire ────────────────────────────────────

RABBITMQ_EXCHANGE_USER         = "njila.user.exchange"           # → njila-user-service
RABBITMQ_EXCHANGE_NOTIFICATION = "njila.notification.exchange"   # → njila-notification-service
RABBITMQ_EXCHANGE_SUBSCRIBE    = "njila.subscribe.exchange"      # ← depuis subscribe-service
RABBITMQ_EXCHANGE_DEAD_LETTER  = "njila.dead.letter.exchange"    # dead letter

# INTERNAL_SERVICE_TOKEN = env("INTERNAL_SERVICE_TOKEN", default="njila-internal-2026")
# AUTH_SERVICE_SHARED_SECRET = os.getenv('AUTH_SERVICE_SHARED_SECRET', 'njila-shared-secret-2026')
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
    
    # Désactiver la sécurité dans la documentation
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
    
    # Permet l'auto-login dans Swagger UI
    "SWAGGER_UI_SETTINGS": {
        "persistAuthorization": True,
        "displayRequestDuration": True,
    },
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(
        minutes=_get("jwt.access.minutes", "JWT_ACCESS_TOKEN_LIFETIME_MINUTES",
                     cast=int, default=15)
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

CORS_ALLOW_ALL_ORIGINS = True
AUTH_USER_MODEL        = "authentication.NjilaUser"
DEFAULT_AUTO_FIELD     = "django.db.models.BigAutoField"
STATIC_URL             = "/static/"

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "[{asctime}] [{levelname}] [{name}] — {message}",
            "style": "{",
        },
        "simple": {
            "format": "[{levelname}] {message}",
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
        "level": "INFO" if DEBUG else "WARNING",  # ← Changé : INFO par défaut
    },
    "loggers": {
        # Vos modules en DEBUG (pour voir vos logs)
        "authentication": {
            "handlers": ["console"],
            "level": "DEBUG",
            "propagate": False,
        },
        # Modules tiers en WARNING ou ERROR (pour ne pas les voir)
        "pika": {
            "handlers": ["console"],
            "level": "WARNING",  # ← Ne montre que les warnings/erreurs
            "propagate": False,
        },
        "pika.heartbeat": {
            "handlers": ["console"],
            "level": "WARNING",
            "propagate": False,
        },
        "httpcore": {
            "handlers": ["console"],
            "level": "WARNING",
            "propagate": False,
        },
        "httpx": {
            "handlers": ["console"],
            "level": "WARNING",
            "propagate": False,
        },
        "asyncio": {
            "handlers": ["console"],
            "level": "WARNING",
            "propagate": False,
        },
        "django.utils.autoreload": {
            "handlers": ["console"],
            "level": "INFO",  # Pour voir quand il y a un vrai rechargement
            "propagate": False,
        },
    },
}