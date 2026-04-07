import jwt
import requests
from django.conf import settings
from django.http import JsonResponse
from rest_framework import status
import re
import logging

logger = logging.getLogger(__name__)

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
            r'^/api/bus/?$',                
            r'^/api/bus/[^/]+/?$',          
            r'^/api/bus/[^/]+/etat/?$',     
            r'^/api/bus/disponibles/?$',    
            r'^/api/stats/?$',              
        ]
        
        is_public = False
        current_path = request.path

        for pattern in public_paths:
            if re.match(pattern, current_path):
                # Pour les endpoints qui sont publics uniquement en GET
                if request.method == 'GET':
                    is_public = True
                break
        
        # Exclure aussi les chemins qui commencent par /admin/
        if current_path.startswith('/admin/'):
            is_public = True
        
        # Exclure les requêtes OPTIONS (CORS)
        if request.method == 'OPTIONS':
            is_public = True
        
        # Si ce n'est pas public, authentifier
        if not is_public:
            # Récupérer le token
            auth_header = request.headers.get('Authorization', '')
            if not auth_header.startswith('Bearer '):
                logger.warning("No Bearer token provided")
                return JsonResponse(
                    {'error': 'Authentication credentials were not provided.'},
                    status=status.HTTP_401_UNAUTHORIZED
                )
            
            token = auth_header.split(' ')[1]
            logger.debug(f"Validating token: {token[:50]}...")
            
            # Valider le token auprès du auth-service
            try:
                response = requests.post(
                    settings.AUTH_SERVICE_TOKEN_VALIDATION_URL,
                    headers={
                        'X-Internal-Token': getattr(settings, 'INTERNAL_SERVICE_TOKEN', 'njila-shared-secret-2026'),
                        'Content-Type': 'application/json'
                    },
                    json={'token': token},
                    timeout=2
                )
                
                logger.debug(f"Auth service response status: {response.status_code}")
                
                if response.status_code == 200:
                    data = response.json()
                    logger.debug(f"Auth service response: {data}")
                    
                    # CORRECTION: Extraire le payload de la structure retournée
                    if data.get('valid') and data.get('payload'):
                        payload = data['payload']
                        # Stocker les informations utilisateur dans le format attendu par les permissions
                        request.user_info = {
                            'userId': payload.get('userId'),
                            'role': payload.get('role'),
                            'sessionId': payload.get('sessionId'),
                            'filialeId': payload.get('filialeId'),
                            'agenceId': payload.get('agenceId'),
                            'exp': payload.get('exp')
                        }
                        logger.info(f"User authenticated successfully: {request.user_info.get('userId')} - Role: {request.user_info.get('role')}")
                    else:
                        logger.error(f"Invalid response structure from auth service: {data}")
                        return JsonResponse(
                            {'error': 'Invalid token response format from authentication service'},
                            status=status.HTTP_401_UNAUTHORIZED
                        )
                else:
                    logger.error(f"Token validation failed with status {response.status_code}: {response.text}")
                    return JsonResponse(
                        {'error': 'Invalid or expired token'},
                        status=status.HTTP_401_UNAUTHORIZED
                    )
                
            except requests.exceptions.RequestException as e:
                logger.error(f"Authentication service unavailable: {str(e)}")
                return JsonResponse(
                    {'error': 'Authentication service unavailable'},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE
                )
        
        return self.get_response(request)