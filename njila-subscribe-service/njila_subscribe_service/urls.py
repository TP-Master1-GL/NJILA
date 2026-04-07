from django.urls import path, include
from django.conf import settings
from rest_framework import permissions
from drf_yasg.views import get_schema_view
from drf_yasg import openapi

schema_view = get_schema_view(
    openapi.Info(
        title="NJILA Subscribe Service API",
        default_version='v1',
        description="API de gestion des souscriptions pour la plateforme NJILA",
        terms_of_service="https://www.njila.cm/terms/",
        contact=openapi.Contact(email="contact@njila.cm"),
        license=openapi.License(name="Proprietary"),
    ),
    public=True,
    permission_classes=[permissions.AllowAny],
)

urlpatterns = [
    path("api/subscribe/", include("agencies.urls")),
    path("api/subscribe/", include("subscriptions.urls")),
    path("actuator/",      include("subscriptions.actuator_urls")),
    
    # Swagger documentation
    path('swagger/', schema_view.with_ui('swagger', cache_timeout=0), name='schema-swagger-ui'),
    path('redoc/', schema_view.with_ui('redoc', cache_timeout=0), name='schema-redoc'),
]

if settings.DEBUG:
    from django.conf.urls.static import static
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)