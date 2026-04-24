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

SECRET_KEY    = env('SECRET_KEY', 'njila-2026-change-in-production')
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
    'drf_spectacular',
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
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    # Vider les classes d'auth DRF pour que drf-spectacular
    # ne génère pas automatiquement basicAuth et cookieAuth dans le schéma
    'DEFAULT_AUTHENTICATION_CLASSES': [],
}

CORS_ALLOW_ALL_ORIGINS = True
DEFAULT_AUTO_FIELD     = 'django.db.models.BigAutoField'
STATIC_URL             = '/static/'

# ============ SPECTACULAR (SWAGGER) CONFIGURATION ============
SPECTACULAR_SETTINGS = {
    'TITLE': 'NJILA Fleet Management API',
    'DESCRIPTION': '''
    API de gestion de flotte pour la plateforme NJILA.
    
    ## Authentification
    Pour tester les endpoints protégés, cliquez sur le bouton **Authorize** en haut à droite
    et entrez votre token JWT au format: `Bearer votre_token_ici`
    
    ## Endpoints publics
    Les endpoints GET (liste, détail, recherche) sont accessibles sans authentification.
    
    ## Endpoints protégés
    Les endpoints POST, PUT, PATCH, DELETE nécessitent les droits appropriés.
    ''',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,

    # Forcer uniquement BearerAuth sur tous les endpoints
    'SECURITY': [{'BearerAuth': []}],

    'COMPONENTS': {
        'securitySchemes': {
            # Schéma JWT Bearer — le seul visible dans Swagger UI
            'BearerAuth': {
                'type': 'http',
                'scheme': 'bearer',
                'bearerFormat': 'JWT',
                'description': 'Entrez votre token JWT au format: Bearer <token>',
            },
        },
        'examples': {
            'agence_example': {
                'summary': "Exemple d'agence",
                'value': {
                    'name': 'Express Voyages',
                    'adresse': '123 Boulevard de la Liberté, Douala',
                    'telephone': '699888888',
                    'email_officiel': 'contact@express.cm',
                    'statut_global': 'active'
                }
            },
            'filiale_example': {
                'summary': 'Exemple de filiale',
                'value': {
                    'nom': 'Agence Centrale Douala',
                    'code': 'DLA-CENTRAL-01',
                    'ville': 'Douala',
                    'adresse': '123 Boulevard de la Liberté, Douala',
                    'telephone': '699777777',
                    'email': 'douala@express.cm',
                    'est_active': True
                }
            },
            'bus_example': {
                'summary': 'Exemple de bus',
                'value': {
                    'immatriculation': 'LT 001 AB',
                    'modele': 'Toyota Coaster',
                    'capacite': 30,
                    'etat': 'disponible'
                }
            },
            'chauffeur_example': {
                'summary': 'Exemple de chauffeur',
                'value': {
                    'numero_permis': 'P12345678',
                    'name': 'Pierre',
                    'surname': 'Kamga',
                    'email': 'pierre.kamga@express.cm',
                    'phone': '699555555',
                    'Adresse': 'Quartier Makepe, Douala',
                    'date_embauche': '2024-01-15',
                    'est_disponible': True
                }
            },
            'voyage_example': {
                'summary': 'Exemple de voyage',
                'value': {
                    'date_heure_depart': '2026-04-10T10:00:00',
                    'date_heure_arrive_prevue': '2026-04-10T15:00:00',
                    'prix': 5000,
                    'type_voyage': 'standard',
                    'status': 'programme',
                    'places_disponibles': 30
                }
            }
        }
    },

    'DEFAULT_AUTO_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',

    # Configuration Swagger UI
    'SWAGGER_UI_SETTINGS': {
        'persistAuthorization': True,
        'displayRequestDuration': True,
        'tryItOutEnabled': True,
        'filter': True,
        'deepLinking': True,
        'showExtensions': True,
        'showCommonExtensions': True,
        'defaultModelsExpandDepth': 2,
        'defaultModelExpandDepth': 2,
        'docExpansion': 'list',
    },

    'SERVE_PERMISSIONS': ['rest_framework.permissions.AllowAny'],
    'SORT_OPERATIONS': False,
    'SCHEMA_PATH_PREFIX': '/api/',
    'ENUM_NAME_OVERRIDES': {},
    'POSTPROCESSING_HOOKS': [
        'drf_spectacular.hooks.postprocess_schema_enums',
        'fleet_config.hooks.postprocess_schema_enrich_with_bearer',  
    ],
}

# ============ FICHIERS MÉDIAS ============
MEDIA_URL = '/media/'
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
AUTH_SERVICE_URL = os.getenv('AUTH_SERVICE_URL', 'http://njila-auth-service:8081')
AUTH_SERVICE_TOKEN_VALIDATION_URL = f"{AUTH_SERVICE_URL}/api/auth/validate-token"
INTERNAL_SERVICE_TOKEN = os.getenv('INTERNAL_SERVICE_TOKEN', 'njila-shared-secret-2026')
if 'test' in sys.argv:
    AUTH_SERVICE_TOKEN_VALIDATION_URL = 'http://testserver/api/auth/validate-token'