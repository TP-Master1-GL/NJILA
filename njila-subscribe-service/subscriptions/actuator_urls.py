from django.urls import path
from rest_framework.views import APIView
from rest_framework.response import Response
from django.db import connection
from django.core.cache import cache


class HealthView(APIView):
    def get(self, request):
        try:
            connection.ensure_connection()
            db = "UP"
        except Exception as e:
            db = f"DOWN: {e}"

        try:
            cache.set("_health", "ok", 5)
            redis = "UP" if cache.get("_health") == "ok" else "WARN"
        except Exception as e:
            redis = f"DOWN: {e}"

        return Response({
            "status":     "UP" if db == "UP" and redis == "UP" else "DOWN",
            "service":    "njila-subscribe-service",
            "components": {"postgresql": {"status": db}, "redis": {"status": redis}},
        })


urlpatterns = [path("health", HealthView.as_view())]
