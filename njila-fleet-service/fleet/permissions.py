# fleet/permissions.py
from rest_framework.permissions import BasePermission
import requests
from django.conf import settings
import logging

logger = logging.getLogger(__name__)


class IsAuthenticated(BasePermission):
    """
    Permission pour les utilisateurs authentifiés
    Vérifie le token JWT via auth-service
    """
    
    def has_permission(self, request, view):
        # Si user_info est déjà dans request (via middleware)
        if hasattr(request, 'user_info') and request.user_info:
            return True
        
        # Récupérer le token depuis l'en-tête Authorization
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            logger.debug("No Bearer token found")
            return False
        
        token = auth_header.split(' ')[1]
        
        # Valider le token auprès du auth-service
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
            
            if response.status_code == 200:
                user_data = response.json()
                request.user_info = user_data
                logger.debug(f"User authenticated: {user_data.get('role')}")
                return True
            else:
                logger.debug(f"Token validation failed: {response.status_code}")
                return False
                
        except requests.exceptions.RequestException as e:
            logger.error(f"Erreur validation token: {e}")
            return False


class IsVoyageur(BasePermission):
    """
    Permission pour les voyageurs
    """
    
    def has_permission(self, request, view):
        if not IsAuthenticated().has_permission(request, view):
            return False
        
        role = request.user_info.get('role')
        return role == 'VOYAGEUR'


class IsGuichetier(BasePermission):
    """
    Permission pour les guichetiers
    """
    
    def has_permission(self, request, view):
        if not IsAuthenticated().has_permission(request, view):
            return False
        
        role = request.user_info.get('role')
        return role in ['GUICHETIER', 'MANAGER_LOCAL', 'MANAGER_GLOBAL', 'ADMINISTRATEUR']


class IsManagerLocal(BasePermission):
    """
    Permission pour les managers locaux (d'une filiale)
    """
    
    def has_permission(self, request, view):
        if not IsAuthenticated().has_permission(request, view):
            return False
        
        role = request.user_info.get('role')
        return role in ['MANAGER_LOCAL', 'MANAGER_GLOBAL', 'ADMINISTRATEUR']
    
    def has_object_permission(self, request, view, obj):
        """
        Vérification au niveau objet (ex: filiale spécifique)
        """
        role = request.user_info.get('role')
        
        # Admin a tous les droits
        if role == 'ADMINISTRATEUR':
            return True
        
        # Manager global a accès à toutes les filiales de son agence
        if role == 'MANAGER_GLOBAL':
            user_agence_id = request.user_info.get('agence_id')
            if hasattr(obj, 'agence_id'):
                return str(obj.agence_id) == user_agence_id
            elif hasattr(obj, 'Id_agence_id'):
                return str(obj.Id_agence_id) == user_agence_id
            elif hasattr(obj, 'agence'):
                return str(obj.agence.id_agence) == user_agence_id
        
        # Manager local a accès uniquement à sa filiale
        if role == 'MANAGER_LOCAL':
            user_filiale_id = request.user_info.get('filiale_id')
            if hasattr(obj, 'filiale_id'):
                return str(obj.filiale_id) == user_filiale_id
            elif hasattr(obj, '_id_filiale_id'):
                return str(obj._id_filiale_id) == user_filiale_id
        
        return False


class IsManagerGlobal(BasePermission):
    """
    Permission pour les managers globaux
    """
    
    def has_permission(self, request, view):
        if not IsAuthenticated().has_permission(request, view):
            return False
        
        role = request.user_info.get('role')
        return role in ['MANAGER_GLOBAL', 'ADMINISTRATEUR']


class IsAdmin(BasePermission):
    """
    Permission pour les administrateurs système
    """
    
    def has_permission(self, request, view):
        if not IsAuthenticated().has_permission(request, view):
            return False
        
        role = request.user_info.get('role')
        return role == 'ADMINISTRATEUR'


class IsChauffeur(BasePermission):
    """
    Permission pour les chauffeurs
    """
    
    def has_permission(self, request, view):
        if not IsAuthenticated().has_permission(request, view):
            return False
        
        role = request.user_info.get('role')
        return role in ['CHAUFFEUR', 'MANAGER_LOCAL', 'MANAGER_GLOBAL', 'ADMINISTRATEUR']