from decouple import config as env
from datetime import timedelta
from pathlib import Path

# ─── 1. Fetch config depuis njila-conf-service ────────────────────────────────
from auth_config.cloud import fetch_remote_config
_remote = fetch_remote_config()


def _get(remote_key, local_key, cast=str, default=None):
    """
    Ordre de priorité :
      1. njila-conf-service (remote)
      2. .env (local)
      3. valeur par défaut
    """
    value = _remote.get(remote_key)
    if value is not None:
        try:
            return cast(value)
        except (ValueError, TypeError):
            pass
    return env(local_key, default=default, cast=cast)


# ─── 2. Port résolu ───────────────────────────────────────────────────────────
# C'est ce port qui sera utilisé pour runserver ET pour l'enregistrement Eureka
SERVER_PORT = _get('server.port', 'PORT', cast=int, default=8081)

# ─── 3. Django settings ───────────────────────────────────────────────────────
BASE_DIR      = Path(__file__).resolve().parent.parent
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
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    'authentication',
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

ROOT_URLCONF     = 'auth_config.urls'
WSGI_APPLICATION = 'auth_config.wsgi.application'

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

# ─── Base de données ──────────────────────────────────────────────────────────
DATABASES = {
    'default': {
        'ENGINE':   'django.db.backends.postgresql',
        'NAME':     _get('db.name',     'DB_NAME',     default='njila-auth-db'),
        'USER':     _get('db.user',     'DB_USER',     default='njila'),
        'PASSWORD': _get('db.password', 'DB_PASSWORD', default='njila2026'),
        'HOST':     _get('db.host',     'DB_HOST',     default='localhost'),
        'PORT':     _get('db.port',     'DB_PORT',     cast=int, default=5432),
    }
}

# ─── Redis ────────────────────────────────────────────────────────────────────
_redis_host = _get('redis.host', 'REDIS_HOST', default='localhost')
_redis_port = _get('redis.port', 'REDIS_PORT', cast=int, default=6379)

CACHES = {
    'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': f"redis://{_redis_host}:{_redis_port}/0",
        'OPTIONS': {
            'CLIENT_CLASS': 'django_redis.client.DefaultClient',
        }
    }
}

# ─── DRF ─────────────────────────────────────────────────────────────────────
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
}

# ─── JWT ─────────────────────────────────────────────────────────────────────
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME':  timedelta(
        minutes=_get('jwt.access.minutes',
                     'JWT_ACCESS_TOKEN_LIFETIME_MINUTES',
                     cast=int, default=15)
    ),
    'REFRESH_TOKEN_LIFETIME': timedelta(
        days=_get('jwt.refresh.days',
                  'JWT_REFRESH_TOKEN_LIFETIME_DAYS',
                  cast=int, default=7)
    ),
    'ROTATE_REFRESH_TOKENS':    True,
    'BLACKLIST_AFTER_ROTATION': True,
    'ALGORITHM':                'HS256',
    'SIGNING_KEY':              env('SECRET_KEY'),
    'AUTH_HEADER_TYPES':        ('Bearer',),
    'TOKEN_OBTAIN_SERIALIZER':
        'authentication.serializers.NjilaTokenObtainPairSerializer',
}

CORS_ALLOW_ALL_ORIGINS = True
AUTH_USER_MODEL        = 'authentication.NjilaUser'
DEFAULT_AUTO_FIELD     = 'django.db.models.BigAutoField'
STATIC_URL             = '/static/'
