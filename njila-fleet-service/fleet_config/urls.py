from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework import permissions
from drf_yasg.views import get_schema_view
from drf_yasg import openapi

# Configuration Swagger/OpenAPI avec support JWT
schema_view = get_schema_view(
    openapi.Info(
        title="NJILA Fleet Management API",
        default_version='v1.0',
        description="""
## API de Gestion de Flotte - Plateforme NJILA

Ce service gère l'ensemble des opérations de flotte pour la plateforme de transport interurbain NJILA.

### Fonctionnalités principales:
- **Gestion des agences** : Création, modification, suppression
- **Gestion des filiales** : Par ville et par agence
- **Gestion de la flotte** : Bus, état, disponibilité
- **Gestion du personnel** : Chauffeurs, guichetiers
- **Gestion des trajets** : Lignes de transport
- **Gestion des voyages** : Programmation, assignation, statuts
- **Gestion des annonces** : Retards, annulations, promotions
- **Gestion des avis** : Évaluations des voyageurs

### Authentification JWT:
Pour tester les endpoints protégés:
1. Obtenez un token via le auth-service (port 8081)
2. Cliquez sur le bouton "Authorize" en haut de cette page
3. Entrez votre token: `Bearer <votre_token>`

### Rôles et permissions:
| Rôle | Permissions |
|------|-------------|
| `VOYAGEUR` | Laisser des avis |
| `GUICHETIER` | Ventes physiques |
| `MANAGER_LOCAL` | CRUD bus, voyages, personnel |
| `MANAGER_GLOBAL` | CRUD filiales, trajets |
| `ADMINISTRATEUR` | CRUD agences |
| `CHAUFFEUR` | Consultation voyages |

### Codes HTTP:
- `200` : Succès
- `201` : Créé avec succès
- `204` : Supprimé avec succès
- `400` : Requête invalide
- `401` : Non authentifié
- `403` : Permission refusée
- `404` : Ressource non trouvée
- `409` : Conflit (donnée déjà existante)
        """,
        terms_of_service="https://www.njila.cm/terms/",
        contact=openapi.Contact(
            name="Support NJILA",
            email="support@njila.cm",
            url="https://www.njila.cm"
        ),
        license=openapi.License(
            name="Proprietary",
            url="https://www.njila.cm/license"
        ),
    ),
    public=True,
    permission_classes=[permissions.AllowAny],
)

urlpatterns = [
    # Admin
    path('admin/', admin.site.urls),
    
    # API endpoints
    path('api/', include('fleet.urls')),
    
    # Documentation Swagger
    path('swagger/', schema_view.with_ui('swagger', cache_timeout=0), name='schema-swagger-ui'),
    path('redoc/', schema_view.with_ui('redoc', cache_timeout=0), name='schema-redoc'),
    path('swagger.json', schema_view.without_ui(cache_timeout=0), name='schema-json'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)