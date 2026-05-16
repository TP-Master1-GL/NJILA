from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.db import connection

@require_http_methods(["GET"])
def health_check(request):
    try:
        # Test rapide de la base de données
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        
        return JsonResponse({
            "status": "UP",
            "service": "njila-auth-service",
            "database": "connected"
        }, status=200)
        
    except Exception as e:
        return JsonResponse({
            "status": "DOWN",
            "service": "njila-auth-service",
            "error": str(e)
        }, status=503)