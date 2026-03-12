from decouple import config as env
from datetime import timedelta
from pathlib import Path
from reporting_config.cloud import fetch_remote_config

BASE_DIR = Path(__file__).resolve().parent.parent

# ── Fetch config depuis njila-conf-service ────────────────────────────────────
_remote = fetch_remote_config()


def _get(remote_key, local_key, cast=str, default=None):
    value = _remote.get(remote_key)
    if value is not None:
        try:
            return cast(value)
        except (ValueError, TypeError):
            pass
    return env(local_key, default=default, cast=cast)


# ── Port résolu ───────────────────────────────────────────────────────────────
SERVER_PORT = _get('server.port', 'PORT', cast=int, default=8087)

# ── Django settings ───────────────────────────────────────────────────────────
SECRET_KEY    = env('SECRET_KEY')
DEBUG         = env('DEBUG', cast=bool, default=True)
ALLOWED_HOSTS = ['*']

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'corsheaders',
    'reporting',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF     = 'reporting_config.urls'
WSGI_APPLICATION = 'reporting_config.wsgi.application'

TEMPLATES = [{
    'BACKEND': 'django.template.backends.django.DjangoTemplates',
    'DIRS': [],
    'APP_DIRS': True,
    'OPTIONS': {
        'context_processors': [
            'django.template.context_processors.debug',
            'django.template.context_processors.request',
            'django.contrib.auth.context_processors.auth',
            'django.contrib.messages.context_processors.messages',
        ],
    },
}]

# ── Base de données ───────────────────────────────────────────────────────────
DATABASES = {
    'default': {
        'ENGINE':   'django.db.backends.postgresql',
        'NAME':     _get('db.name',     'DB_NAME',     default='njila-reporting-db'),
        'USER':     _get('db.user',     'DB_USER',     default='njila'),
        'PASSWORD': _get('db.password', 'DB_PASSWORD', default='njila2026'),
        'HOST':     _get('db.host',     'DB_HOST',     default='localhost'),
        'PORT':     _get('db.port',     'DB_PORT',     cast=int, default=5432),
    }
}

# ── Redis ─────────────────────────────────────────────────────────────────────
_redis_host = _get('redis.host', 'REDIS_HOST', default='localhost')
_redis_port = _get('redis.port', 'REDIS_PORT', cast=int, default=6379)

CACHES = {
    'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': f"redis://{_redis_host}:{_redis_port}/3",
        'OPTIONS': {
            'CLIENT_CLASS': 'django_redis.client.DefaultClient',
        }
    }
}

# ── DRF ──────────────────────────────────────────────────────────────────────
REST_FRAMEWORK = {
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.AllowAny',
    ),
}

CORS_ALLOW_ALL_ORIGINS = True
DEFAULT_AUTO_FIELD     = 'django.db.models.BigAutoField'
STATIC_URL             = '/static/'
