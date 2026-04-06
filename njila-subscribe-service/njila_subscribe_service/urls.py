from django.urls import path, include

urlpatterns = [
    path("api/subscribe/", include("agencies.urls")),
    path("api/subscribe/", include("subscriptions.urls")),
    path("actuator/",      include("subscriptions.actuator_urls")),
]