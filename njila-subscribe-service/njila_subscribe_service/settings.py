import os
import sys

# Ajouter la racine du projet au path pour importer cloud.py
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from cloud import fetch_remote_config

# ─── Récupération config distante ─────────────────────────────────────────────
_cfg = fetch_remote_config()


def _get(key: str, default: str = "") -> str:
    """
    Cherche d'abord dans la config distante (njila-conf-service),
    puis dans les variables d'environnement système,
    puis retombe sur le défaut codé en dur.
    """
    return _cfg.get(key, os.environ.get(
        # Convertit db.host → DB_HOST  /  rabbitmq.host → RABBITMQ_HOST
        key.replace(".", "_").replace("-", "_").upper(),
        default
    ))


# ─── Django core ──────────────────────────────────────────────────────────────

SECRET_KEY  = _get("django.secret-key", "njila-subscribe-insecure-change-me")
DEBUG = True
SERVER_PORT = int(_get("server.port", "8090"))

ALLOWED_HOSTS = _get("django.allowed-hosts", "*").split(",")

INSTALLED_APPS = [
    "django.contrib.contenttypes",
    "django.contrib.auth",
    "rest_framework",
    "corsheaders",
    "django_celery_beat",
    "agencies",
    "subscriptions",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.middleware.common.CommonMiddleware",
]

ROOT_URLCONF     = "njila_subscribe_service.urls"
WSGI_APPLICATION = "njila_subscribe_service.wsgi.application"

# ─── Base de données ──────────────────────────────────────────────────────────
# Clés issues de njila-subscribe-service.properties : db.*

DATABASES = {
    "default": {
        "ENGINE":   "django.db.backends.postgresql",
        "HOST":     _get("db.host",     "localhost"),
        "PORT":     _get("db.port",     "5432"),
        "NAME":     _get("db.name",     "njila-subscribe-db"),
        "USER":     _get("db.username", "njila"),
        "PASSWORD": _get("db.password", "njila2026"),
    }
}

# ─── Redis ────────────────────────────────────────────────────────────────────
# Clé : redis.url

REDIS_URL = _get("redis.url", "redis://localhost:6379/0")

CACHES = {
    "default": {
        "BACKEND":  "django_redis.cache.RedisCache",
        "LOCATION": REDIS_URL,
        "OPTIONS":  {"CLIENT_CLASS": "django_redis.client.DefaultClient"},
    }
}

# ─── RabbitMQ / Celery ────────────────────────────────────────────────────────
# Clés : rabbitmq.*

RABBITMQ_HOST     = _get("rabbitmq.host",     "localhost")
RABBITMQ_PORT     = int(_get("rabbitmq.port", "5672"))
RABBITMQ_USER     = _get("rabbitmq.username", "guest")
RABBITMQ_PASSWORD = _get("rabbitmq.password", "guest")
RABBITMQ_EXCHANGE = _get("rabbitmq.exchange", "njila.subscribe.exchange")

CELERY_BROKER_URL     = f"amqp://{RABBITMQ_USER}:{RABBITMQ_PASSWORD}@{RABBITMQ_HOST}:{RABBITMQ_PORT}/"
CELERY_RESULT_BACKEND = REDIS_URL
CELERY_BEAT_SCHEDULER = "django_celery_beat.schedulers:DatabaseScheduler"

# ─── Eureka ───────────────────────────────────────────────────────────────────
# Clé : eureka.url

EUREKA_URL = _get("eureka.url", "http://localhost:8761/eureka/")

# ─── REST Framework ───────────────────────────────────────────────────────────

REST_FRAMEWORK = {
    "DEFAULT_RENDERER_CLASSES":      ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_AUTHENTICATION_CLASSES": [],
    "DEFAULT_PERMISSION_CLASSES":    [],
    "DEFAULT_PAGINATION_CLASS":      "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
}

# ─── Internationalisation ─────────────────────────────────────────────────────

LANGUAGE_CODE = "fr-fr"
TIME_ZONE     = "Africa/Douala"
USE_I18N      = True
USE_TZ        = True

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
CORS_ALLOW_ALL_ORIGINS = True