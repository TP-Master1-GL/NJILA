import jwt
import requests
from django.conf import settings
from django.http import JsonResponse
from rest_framework import status
import re

class JWTAuthenticationMiddleware:
    """
    Middleware pour authentifier les requêtes via JWT
    """
    
    def __init__(self, get_response):
        self.get_response = get_response
    
    def __call__(self, request):
        # Exclure les endpoints publics de l'authentification
        public_paths = [
            r'^/api/health/?$',
            r'^/api/swagger/?.*$',
            r'^/api/redoc/?.*$',
            r'^/api/agences/?$',           
            r'^/api/agences/[^/]+/?$',     
            r'^/api/filiales/?$',           
            r'^/api/filiales/[^/]+/?$',     
            r'^/api/filiales/[^/]+/stats/?$',
            r'^/api/trajets/?$',            
            r'^/api/trajets/[^/]+/?$',      
            r'^/api/voyages/?$',            
            r'^/api/voyages/recherche/?$',
            r'^/api/voyages/[^/]+/?$',      
            r'^/api/annonces/?$',           
            r'^/api/annonces/[^/]+/?$',     
            r'^/api/avis/?$',              
            r'^/api/avis/[^/]+/?$',         
            r'^/api/avis/voyage/[^/]+/stats/?$',
            r'^/api/bus/?$',                # GET public
            r'^/api/bus/[^/]+/?$',          # GET public
            r'^/api/bus/[^/]+/etat/?$',     # GET public
            r'^/api/bus/disponibles/?$',    # GET public
            r'^/api/stats/?$',              # GET public
        ]
        # Vérifier si le chemin est public
        is_public = False
        current_path = request.path
        
        # print(f"DEBUG: Path={current_path}, Method={request.method}")

        for pattern in public_paths:
            if re.match(pattern, current_path):
                # Pour les endpoints qui sont publics uniquement en GET
                if request.method == 'GET':
                    is_public = True
                    break
                # POST/PUT/DELETE restent protégés
                break
        
        # Exclure aussi les chemins qui commencent par /admin/
        if current_path.startswith('/admin/'):
            is_public = True
        
        # Exclure les requêtes OPTIONS (CORS)
        if request.method == 'OPTIONS':
            is_public = True
        
        if not is_public:
            # Récupérer le token
            auth_header = request.headers.get('Authorization', '')
            if not auth_header.startswith('Bearer '):
                return JsonResponse(
                    {'error': 'Authentication credentials were not provided.'},
                    status=status.HTTP_401_UNAUTHORIZED
                )
            
            token = auth_header.split(' ')[1]
            
            # Valider le token
            try:
                response = requests.post(
                    settings.AUTH_SERVICE_TOKEN_VALIDATION_URL,
                    headers={
                        'X-Internal-Token': settings.AUTH_SERVICE_SHARED_SECRET,
                        'Content-Type': 'application/json'
                    },
                    json={'token': token},
                    timeout=2
                )
                
                if response.status_code != 200:
                    return JsonResponse(
                        {'error': 'Invalid or expired token'},
                        status=status.HTTP_401_UNAUTHORIZED
                    )
                
                # Ajouter les infos utilisateur à la requête
                request.user_info = response.json()
                
            except requests.exceptions.RequestException as e:
                return JsonResponse(
                    {'error': 'Authentication service unavailable'},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE
                )
        
        return self.get_response(request)