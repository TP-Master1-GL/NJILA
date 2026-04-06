"""
AuthController — endpoints REST de l'auth-service — v1.3

Endpoints :
  GET    /api/auth/health
  POST   /api/auth/register             (public)
  POST   /api/auth/login                (public)
  POST   /api/auth/logout               (authentifié)
  POST   /api/auth/refresh              (public)
  POST   /api/auth/forgot-password      (public)
  POST   /api/auth/reset-password       (public)
  GET    /api/auth/me                   (authentifié)
  PATCH  /api/auth/me                   (authentifié) — mise à jour profil (v1.3)
  PATCH  /api/auth/me/photo             (authentifié) — mise à jour photo
  POST   /api/auth/validate-token       (services internes)
  PATCH  /api/auth/users/:id/status     (Admin)
"""

import logging

from rest_framework import status
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from authentication.middleware.auth_middleware import (
    IsAdministrateur,
    IsAuthenticated,
    IsInternalService,
    NjilaJWTAuthentication,
)
from authentication.models import Role
from authentication.serializers.auth_serializers import (
    AccountStatusSerializer,
    ForgotPasswordSerializer,
    LoginSerializer,
    PhotoUpdateSerializer,
    ProfileUpdateSerializer,
    RefreshSerializer,
    RegisterSerializer,
    ResetPasswordSerializer,
    UserMeSerializer,
    ValidateTokenSerializer,
)
from authentication.services.auth_service import (
    AccountInactiveError,
    AccountLockedError,
    AuthService,
    EmailAlreadyExistsError,
    InvalidCredentialsError,
    LoginCommand,
    RegisterCommand,
    SessionExpiredError,
    TokenInvalidError,
)

logger = logging.getLogger(__name__)

_auth_service = AuthService()


# ─────────────────────────────────────────────────────────────────────────────
# Health
# ─────────────────────────────────────────────────────────────────────────────
@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def health(request):
    return Response({"status": "UP", "service": "njila-auth-service"})


# ─────────────────────────────────────────────────────────────────────────────
# Register
# ─────────────────────────────────────────────────────────────────────────────
@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def register(request):
    """
    201 — Inscription voyageur réussie
    400 — Données invalides (name/surname manquants, password trop court…)
    403 — Rôle non autorisé en auto-inscription
    409 — Email déjà utilisé
    """
    serializer = RegisterSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(
            {"error": "Données invalides.", "details": serializer.errors},
            status=status.HTTP_400_BAD_REQUEST,
        )

    data = serializer.validated_data
    role = data.get("role", Role.VOYAGEUR)

    if role != Role.VOYAGEUR:
        return Response(
            {"error": "L'auto-inscription est réservée aux voyageurs."},
            status=status.HTTP_403_FORBIDDEN,
        )

    try:
        result = _auth_service.register(RegisterCommand(
            email      = data["email"],
            password   = data["password"],
            name       = data["name"],
            surname    = data["surname"],
            phone      = data.get("phone"),
            adresse    = data.get("adresse"),
            role       = role,
            photo_url  = data.get("photo_url"),
            filiale_id = str(data["filiale_id"]) if data.get("filiale_id") else None,
            agence_id  = str(data["agence_id"])  if data.get("agence_id")  else None,
        ))
    except EmailAlreadyExistsError as e:
        return Response({"error": str(e)}, status=status.HTTP_409_CONFLICT)

    return Response(
        {
            "userId":       result.user_id,
            "email":        result.email,
            "name":         result.name,
            "surname":      result.surname,
            "role":         result.role,
            "photoUrl":     result.photo_url,
            "accessToken":  result.token_pair.access_token,
            "refreshToken": result.token_pair.refresh_token,
            "expiresIn":    result.token_pair.expires_in,
            "tokenType":    result.token_pair.token_type,
        },
        status=status.HTTP_201_CREATED,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Login
# ─────────────────────────────────────────────────────────────────────────────
@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def login(request):
    serializer = LoginSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(
            {"error": "Données invalides.", "details": serializer.errors},
            status=status.HTTP_400_BAD_REQUEST,
        )

    data = serializer.validated_data
    try:
        result = _auth_service.login(LoginCommand(
            email    = data["email"],
            password = data["password"],
        ))
    except InvalidCredentialsError as e:
        return Response({"error": str(e)}, status=status.HTTP_401_UNAUTHORIZED)
    except AccountLockedError as e:
        return Response({"error": str(e)}, status=status.HTTP_403_FORBIDDEN)
    except AccountInactiveError as e:
        from authentication.models import NjilaUser, DeactivationReason
        try:
            u = NjilaUser.objects.get(email=data["email"].lower().strip())
            if u.deactivation_reason == DeactivationReason.SUBSCRIPTION_EXPIRED:
                return Response(
                    {"error": str(e), "code": "SUBSCRIPTION_EXPIRED"},
                    status=status.HTTP_403_FORBIDDEN,
                )
        except NjilaUser.DoesNotExist:
            pass
        return Response({"error": str(e)}, status=status.HTTP_403_FORBIDDEN)

    return Response({
        "userId":       result.user_id,
        "email":        result.email,
        "name":         result.name,
        "surname":      result.surname,
        "role":         result.role,
        "photoUrl":     result.photo_url,
        "accessToken":  result.token_pair.access_token,
        "refreshToken": result.token_pair.refresh_token,
        "expiresIn":    result.token_pair.expires_in,
        "tokenType":    result.token_pair.token_type,
    })


# ─────────────────────────────────────────────────────────────────────────────
# Logout
# ─────────────────────────────────────────────────────────────────────────────
@api_view(["POST"])
@authentication_classes([NjilaJWTAuthentication])
@permission_classes([IsAuthenticated])
def logout(request):
    auth_header = request.META.get("HTTP_AUTHORIZATION", "")
    if not auth_header.startswith("Bearer "):
        return Response({"error": "Token manquant."}, status=status.HTTP_401_UNAUTHORIZED)

    access_token = auth_header[len("Bearer "):]
    logout_all   = request.query_params.get("all", "false").lower() == "true"

    try:
        _auth_service.logout(access_token, logout_all=logout_all)
    except TokenInvalidError as e:
        return Response({"error": str(e)}, status=status.HTTP_401_UNAUTHORIZED)

    return Response(status=status.HTTP_204_NO_CONTENT)


# ─────────────────────────────────────────────────────────────────────────────
# Refresh
# ─────────────────────────────────────────────────────────────────────────────
@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def refresh_token(request):
    serializer = RefreshSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(
            {"error": "refresh_token requis.", "details": serializer.errors},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        token_pair = _auth_service.refresh(serializer.validated_data["refresh_token"])
    except (TokenInvalidError, SessionExpiredError) as e:
        return Response({"error": str(e)}, status=status.HTTP_401_UNAUTHORIZED)

    return Response({
        "accessToken":  token_pair.access_token,
        "refreshToken": token_pair.refresh_token,
        "expiresIn":    token_pair.expires_in,
        "tokenType":    token_pair.token_type,
    })


# ─────────────────────────────────────────────────────────────────────────────
# Forgot password
# ─────────────────────────────────────────────────────────────────────────────
@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def forgot_password(request):
    serializer = ForgotPasswordSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(
            {"error": "Email invalide.", "details": serializer.errors},
            status=status.HTTP_400_BAD_REQUEST,
        )

    base_url = request.build_absolute_uri("/").rstrip("/")
    _auth_service.request_password_reset(
        email    = serializer.validated_data["email"],
        base_url = base_url,
    )
    return Response({
        "message": "Si cet email est enregistré, un lien de réinitialisation a été envoyé."
    })


# ─────────────────────────────────────────────────────────────────────────────
# Reset password
# ─────────────────────────────────────────────────────────────────────────────
@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def reset_password(request):
    serializer = ResetPasswordSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(
            {"error": "Données invalides.", "details": serializer.errors},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        _auth_service.confirm_password_reset(
            token_str    = serializer.validated_data["token"],
            new_password = serializer.validated_data["new_password"],
        )
    except TokenInvalidError as e:
        return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    return Response({"message": "Mot de passe réinitialisé avec succès."})


# ─────────────────────────────────────────────────────────────────────────────
# Me — GET profil
# ─────────────────────────────────────────────────────────────────────────────
@api_view(["GET"])
@authentication_classes([NjilaJWTAuthentication])
@permission_classes([IsAuthenticated])
def me(request):
    user = _auth_service.get_me(request.user.id)
    if user is None:
        return Response({"error": "Utilisateur introuvable."}, status=status.HTTP_404_NOT_FOUND)
    return Response(UserMeSerializer(user).data)


# ─────────────────────────────────────────────────────────────────────────────
# Me — PATCH mise à jour profil (name, surname, phone, adresse)
# ─────────────────────────────────────────────────────────────────────────────
@api_view(["PATCH"])
@authentication_classes([NjilaJWTAuthentication])
@permission_classes([IsAuthenticated])
def update_profile(request):
    """
    Met à jour les données de profil de l'utilisateur connecté.
    Tous les champs sont optionnels (PATCH partiel).
    Body : { name?, surname?, phone?, adresse? }
    """
    serializer = ProfileUpdateSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(
            {"error": "Données invalides.", "details": serializer.errors},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = _auth_service.get_me(request.user.id)
    if user is None:
        return Response({"error": "Utilisateur introuvable."}, status=status.HTTP_404_NOT_FOUND)

    data = serializer.validated_data
    updated_fields = []

    if "name"    in data and data["name"]    is not None:
        user.name    = data["name"];    updated_fields.append("name")
    if "surname" in data and data["surname"] is not None:
        user.surname = data["surname"]; updated_fields.append("surname")
    if "phone"   in data:
        user.phone   = data["phone"];   updated_fields.append("phone")
    if "adresse" in data:
        user.adresse = data["adresse"]; updated_fields.append("adresse")

    if updated_fields:
        updated_fields.append("updated_at")
        user.save(update_fields=updated_fields)

        # Notifier le user-service de la mise à jour
        try:
            from authentication.events.publisher import EventPublisher
            EventPublisher().publish_user_updated(
                user_id       = str(user.id),
                email         = user.email,
                email_changed = False,
                photo_url     = user.photo_url,
            )
        except Exception as e:
            logger.warning("[VIEW] Événement profile update non envoyé : %s", e)

    return Response(UserMeSerializer(user).data)


# ─────────────────────────────────────────────────────────────────────────────
# Update photo de profil — PATCH /api/auth/me/photo
# ─────────────────────────────────────────────────────────────────────────────
@api_view(["PATCH"])
@authentication_classes([NjilaJWTAuthentication])
@permission_classes([IsAuthenticated])
def update_photo(request):
    serializer = PhotoUpdateSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(
            {"error": "Données invalides.", "details": serializer.errors},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        user = _auth_service.update_photo(
            user_id   = request.user.id,
            photo_url = serializer.validated_data["photo_url"],
        )
    except ValueError as e:
        return Response({"error": str(e)}, status=status.HTTP_404_NOT_FOUND)

    return Response({"message": "Photo de profil mise à jour.", "photoUrl": user.photo_url})


# ─────────────────────────────────────────────────────────────────────────────
# Validate token (interne — API Gateway)
# ─────────────────────────────────────────────────────────────────────────────
@api_view(["POST"])
@authentication_classes([])
@permission_classes([IsInternalService])
def validate_token(request):
    serializer = ValidateTokenSerializer(data=request.data)
    if not serializer.is_valid():
        return Response({"error": "token requis."}, status=status.HTTP_400_BAD_REQUEST)

    payload = _auth_service.validate_token(serializer.validated_data["token"])
    if payload is None:
        return Response({"valid": False}, status=status.HTTP_401_UNAUTHORIZED)

    return Response({
        "valid": True,
        "payload": {
            "userId":    payload.user_id,
            "role":      payload.role,
            "sessionId": payload.session_id,
            "filialeId": payload.filiale_id,
            "agenceId":  payload.agence_id,
            "exp":       payload.exp,
        }
    })


# ─────────────────────────────────────────────────────────────────────────────
# Account status (Admin)
# ─────────────────────────────────────────────────────────────────────────────
@api_view(["PATCH"])
@authentication_classes([NjilaJWTAuthentication])
@permission_classes([IsAdministrateur])
def account_status(request, user_id: str):
    serializer = AccountStatusSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(
            {"error": "Données invalides.", "details": serializer.errors},
            status=status.HTTP_400_BAD_REQUEST,
        )

    is_active = serializer.validated_data["status"] == "active"
    try:
        _auth_service.set_account_status(user_id, is_active)
    except ValueError as e:
        return Response({"error": str(e)}, status=status.HTTP_404_NOT_FOUND)

    return Response({
        "message": f"Compte {'activé' if is_active else 'désactivé/suspendu'} avec succès."
    })