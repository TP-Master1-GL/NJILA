"""
AuthMiddleware — correspond à la classe AuthMiddleware du diagramme UML.

Méthodes :
  authenticate(request)  → extrait et valide le JWT
  authorize(roles)       → vérifie les permissions RBAC
  extractToken(header)   → extrait le Bearer token

Implémenté comme :
  1. JWTAuthentication DRF (pour les vues protégées)
  2. Permission classes RBAC
  3. Décorateur @require_roles
"""

import logging
from functools import wraps
from typing import Optional, Tuple

from django.conf import settings
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.permissions import BasePermission
from rest_framework.request import Request

from authentication.services.jwt_service import JwtTokenService, TokenPayload
from authentication.services.redis_cache import RedisSessionCache
from authentication.models import NjilaUser, Role

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Objet "utilisateur authentifié" injecté dans request.user
# ─────────────────────────────────────────────────────────────────────────────
class AuthenticatedUser:
    """
    Représente l'utilisateur courant extrait du JWT.
    Injecté dans request.user par NjilaJWTAuthentication.
    """

    def __init__(self, payload: TokenPayload):
        self.id         = payload.user_id
        self.role       = payload.role
        self.session_id = payload.session_id
        self.filiale_id = payload.filiale_id
        self.agence_id  = payload.agence_id
        self.is_authenticated = True
        self.is_anonymous     = False

    def has_role(self, *roles) -> bool:
        return self.role in roles

    def __str__(self):
        return f"User({self.id}, {self.role})"


# ─────────────────────────────────────────────────────────────────────────────
# Authentication class DRF
# ─────────────────────────────────────────────────────────────────────────────
class NjilaJWTAuthentication(BaseAuthentication):
    """
    Authentification JWT pour DRF.
    Correspond à authenticate(request) du diagramme AuthMiddleware.
    """

    def __init__(self):
        self._jwt   = JwtTokenService()
        self._cache = RedisSessionCache()

    def authenticate(self, request: Request) -> Optional[Tuple[AuthenticatedUser, str]]:
        """
        Extrait et valide le JWT depuis le header Authorization.
        Retourne (user, token) ou None (laisse les autres backends tenter).
        """
        token = self.extract_token(request)
        if token is None:
            return None

        # Vérification blacklist
        jti = self._jwt.get_jti(token)
        if jti and self._cache.is_blacklisted(jti):
            raise AuthenticationFailed("Token révoqué. Veuillez vous reconnecter.")

        # Décodage
        payload = self._jwt.decode(token)
        if payload is None:
            raise AuthenticationFailed("Token invalide ou expiré.")

        # Vérification session Redis
        if not self._cache.session_exists(payload.session_id):
            raise AuthenticationFailed("Session expirée. Veuillez vous reconnecter.")

        user = AuthenticatedUser(payload)
        logger.debug("[AUTH_MIDDLEWARE] Authentifié : %s [%s]", user.id, user.role)
        return (user, token)

    def extract_token(self, request: Request) -> Optional[str]:
        """
        extractToken(header: String) — diagramme UML.
        Extrait le token Bearer du header Authorization.
        """
        auth_header = request.META.get("HTTP_AUTHORIZATION", "")
        if not auth_header.startswith("Bearer "):
            return None
        token = auth_header[len("Bearer "):]
        return token.strip() if token.strip() else None

    def authenticate_header(self, request: Request) -> str:
        return 'Bearer realm="NJILA"'


# ─────────────────────────────────────────────────────────────────────────────
# Permission classes RBAC
# ─────────────────────────────────────────────────────────────────────────────
class IsAuthenticated(BasePermission):
    """Requiert uniquement d'être authentifié (tout rôle)."""

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)


class IsAdministrateur(BasePermission):
    def has_permission(self, request, view):
        return (
            bool(request.user and request.user.is_authenticated)
            and request.user.role == Role.ADMINISTRATEUR
        )


class IsManagerGlobal(BasePermission):
    def has_permission(self, request, view):
        return (
            bool(request.user and request.user.is_authenticated)
            and request.user.role in [Role.MANAGER_GLOBAL, Role.ADMINISTRATEUR]
        )


class IsManagerLocal(BasePermission):
    def has_permission(self, request, view):
        return (
            bool(request.user and request.user.is_authenticated)
            and request.user.role in [
                Role.MANAGER_LOCAL, Role.MANAGER_GLOBAL, Role.ADMINISTRATEUR
            ]
        )


class IsGuichetier(BasePermission):
    def has_permission(self, request, view):
        return (
            bool(request.user and request.user.is_authenticated)
            and request.user.role == Role.GUICHETIER
        )


class IsInternalService(BasePermission):
    """
    Accès réservé aux services internes (validate-token).
    Vérifie un header X-Internal-Token secret.
    """

    def has_permission(self, request, view):
        internal_token = request.META.get("HTTP_X_INTERNAL_TOKEN", "")
        expected       = getattr(settings, "INTERNAL_SERVICE_TOKEN", "")
        return bool(expected and internal_token == expected)


# ─────────────────────────────────────────────────────────────────────────────
# Décorateur @require_roles
# ─────────────────────────────────────────────────────────────────────────────
def require_roles(*roles):
    """
    authorize(roles) — diagramme UML AuthMiddleware.
    Décorateur pour restreindre l'accès à certains rôles.

    Usage :
        @require_roles(Role.ADMINISTRATEUR, Role.MANAGER_GLOBAL)
        def my_view(request):
            ...
    """
    def decorator(view_func):
        @wraps(view_func)
        def wrapper(request, *args, **kwargs):
            from rest_framework.response import Response
            from rest_framework import status

            if not request.user or not request.user.is_authenticated:
                return Response(
                    {"error": "Non authentifié."},
                    status=status.HTTP_401_UNAUTHORIZED
                )
            if request.user.role not in roles:
                return Response(
                    {"error": f"Accès refusé. Rôles requis : {', '.join(roles)}"},
                    status=status.HTTP_403_FORBIDDEN
                )
            return view_func(request, *args, **kwargs)
        return wrapper
    return decorator