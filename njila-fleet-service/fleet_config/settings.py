from decouple import config as env
from pathlib import Path
from fleet_config.cloud import fetch_remote_config
import os
from datetime import timedelta

import sys



BASE_DIR = Path(__file__).resolve().parent.parent

_remote = fetch_remote_config()


def _get(remote_key, local_key, cast=str, default=None):
    value = _remote.get(remote_key)
    if value is not None:
        try:
            return cast(value)
        except (ValueError, TypeError):
            pass
    return env(local_key, default=default, cast=cast)


SERVER_PORT = _get('server.port', 'PORT', cast=int, default=8088)

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
    'fleet',
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
    'fleet.middleware.JWTAuthenticationMiddleware',
]

ROOT_URLCONF     = 'fleet_config.urls'
WSGI_APPLICATION = 'fleet_config.wsgi.application'

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

DATABASES = {
    'default': {
        'ENGINE':   'django.db.backends.postgresql',
        'NAME':     _get('db.name',     'DB_NAME',     default='njila-fleet-db'),
        'USER':     _get('db.user',     'DB_USER',     default='njila'),
        'PASSWORD': _get('db.password', 'DB_PASSWORD', default='njila2026'),
        'HOST':     _get('db.host',     'DB_HOST',     default='localhost'),
        'PORT':     _get('db.port',     'DB_PORT',     cast=int, default=5433),
    }
}

_redis_host = _get('redis.host', 'REDIS_HOST', default='localhost')
_redis_port = _get('redis.port', 'REDIS_PORT', cast=int, default=6379)

CACHES = {
    'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': f"redis://{_redis_host}:{_redis_port}/4",
        'OPTIONS': {
            'CLIENT_CLASS': 'django_redis.client.DefaultClient',
        }
    }
}

REST_FRAMEWORK = {
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.AllowAny',
    ),
}

CORS_ALLOW_ALL_ORIGINS = True
DEFAULT_AUTO_FIELD     = 'django.db.models.BigAutoField'
STATIC_URL             = '/static/'


# ============ FICHIERS MÉDIAS ============
# URL pour accéder aux fichiers médias
MEDIA_URL = '/media/'

# Chemin absolu où les fichiers seront stockés
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

# ============ JWT CONFIGURATION ============

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=15),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': SECRET_KEY,
    'VERIFYING_KEY': None,
    'AUTH_HEADER_TYPES': ('Bearer',),
    'USER_ID_FIELD': 'id',
    'USER_ID_CLAIM': 'user_id',
    'AUTH_TOKEN_CLASSES': ('rest_framework_simplejwt.tokens.AccessToken',),
    'TOKEN_TYPE_CLAIM': 'token_type',
    'JTI_CLAIM': 'jti',
}

# ============ AUTH SERVICE CONFIGURATION ============
# URL du auth-service pour la validation des tokens
AUTH_SERVICE_URL = os.getenv('AUTH_SERVICE_URL', 'http://localhost:8081')
AUTH_SERVICE_TOKEN_VALIDATION_URL = f"{AUTH_SERVICE_URL}/api/auth/validate-token"

# Clé secrète partagée avec auth-service (à mettre dans .env)
# AUTH_SERVICE_SHARED_SECRET = os.getenv('AUTH_SERVICE_SHARED_SECRET', 'njila-shared-secret-2026')
INTERNAL_SERVICE_TOKEN = os.getenv('INTERNAL_SERVICE_TOKEN', 'njila-shared-secret-2026')
if 'test' in sys.argv:
    AUTH_SERVICE_TOKEN_VALIDATION_URL = 'http://testserver/api/auth/validate-token'