import logging

from drf_spectacular.utils import extend_schema, OpenApiResponse, OpenApiParameter
from rest_framework import status
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import serializers as drf_serializers

from authentication.middleware.auth_middleware import (
    IsAdministrateur,
    IsAuthenticated,
    IsInternalService,
    NjilaJWTAuthentication,
)
from authentication.models import Role
from authentication.serializers.auth_serializers import (
    AccountStatusSerializer,
    ChangePasswordSerializer,
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
# Serializers de réponse (documentation Swagger uniquement)
# ─────────────────────────────────────────────────────────────────────────────

class AuthResponseSerializer(drf_serializers.Serializer):
    userId       = drf_serializers.UUIDField()
    email        = drf_serializers.EmailField()
    name         = drf_serializers.CharField()
    surname      = drf_serializers.CharField()
    role         = drf_serializers.ChoiceField(choices=[c[0] for c in Role.choices])
    photoUrl     = drf_serializers.URLField(allow_null=True)
    accessToken  = drf_serializers.CharField()
    refreshToken = drf_serializers.CharField()
    expiresIn    = drf_serializers.IntegerField()
    tokenType    = drf_serializers.CharField(default="Bearer")


class TokenPairResponseSerializer(drf_serializers.Serializer):
    accessToken  = drf_serializers.CharField()
    refreshToken = drf_serializers.CharField()
    expiresIn    = drf_serializers.IntegerField()
    tokenType    = drf_serializers.CharField(default="Bearer")


class MessageResponseSerializer(drf_serializers.Serializer):
    message = drf_serializers.CharField()


class HealthResponseSerializer(drf_serializers.Serializer):
    status  = drf_serializers.CharField()
    service = drf_serializers.CharField()


class PhotoResponseSerializer(drf_serializers.Serializer):
    message  = drf_serializers.CharField()
    photoUrl = drf_serializers.URLField()


class AccountStatusResponseSerializer(drf_serializers.Serializer):
    message = drf_serializers.CharField()


class ValidateTokenPayloadSerializer(drf_serializers.Serializer):
    userId    = drf_serializers.UUIDField()
    role      = drf_serializers.CharField()
    sessionId = drf_serializers.UUIDField()
    filialeId = drf_serializers.UUIDField(allow_null=True)
    agenceId  = drf_serializers.UUIDField(allow_null=True)
    exp       = drf_serializers.IntegerField()


class ValidateTokenResponseSerializer(drf_serializers.Serializer):
    valid   = drf_serializers.BooleanField()
    payload = ValidateTokenPayloadSerializer()


class ErrorSerializer(drf_serializers.Serializer):
    error   = drf_serializers.CharField()
    details = drf_serializers.DictField(required=False)


# ─────────────────────────────────────────────────────────────────────────────
# Vues
# ─────────────────────────────────────────────────────────────────────────────

@extend_schema(
    tags=["Santé"],
    summary="Health check",
    description="Vérifie que le service d'authentification est opérationnel.",
    responses={200: HealthResponseSerializer},
)
@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def health(request):
    return Response({"status": "UP", "service": "njila-auth-service"})


@extend_schema(
    tags=["Auth"],
    summary="Inscription d'un voyageur",
    description=(
        "Crée un nouveau compte utilisateur avec le rôle VOYAGEUR. "
        "L'auto-inscription est uniquement autorisée pour ce rôle."
    ),
    request=RegisterSerializer,
    responses={
        201: AuthResponseSerializer,
        400: OpenApiResponse(response=ErrorSerializer, description="Données invalides (champs manquants ou incorrects)"),
        403: OpenApiResponse(response=ErrorSerializer, description="Rôle non autorisé à l'auto-inscription"),
        409: OpenApiResponse(response=ErrorSerializer, description="Email déjà utilisé"),
    },
)
@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def register(request):
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


@extend_schema(
    tags=["Auth"],
    summary="Connexion",
    description=(
        "Authentifie un utilisateur avec son email et mot de passe. "
        "Retourne une paire de tokens JWT (access + refresh)."
    ),
    request=LoginSerializer,
    responses={
        200: AuthResponseSerializer,
        400: OpenApiResponse(response=ErrorSerializer, description="Données invalides"),
        401: OpenApiResponse(response=ErrorSerializer, description="Email ou mot de passe incorrect"),
        403: OpenApiResponse(
            response=ErrorSerializer,
            description="Compte verrouillé (trop de tentatives) ou inactif.",
        ),
    },
)
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


@extend_schema(
    tags=["Auth"],
    summary="Déconnexion",
    description=(
        "Invalide le token d'accès de la session courante. "
        "Avec `?all=true`, toutes les sessions actives de l'utilisateur sont révoquées."
    ),
    parameters=[
        OpenApiParameter(
            name="all",
            location=OpenApiParameter.QUERY,
            description="Si `true`, révoque toutes les sessions actives.",
            required=False,
            type=bool,
            default=False,
        )
    ],
    responses={
        204: OpenApiResponse(description="Déconnexion réussie"),
        401: OpenApiResponse(response=ErrorSerializer, description="Token manquant ou invalide"),
    },
)
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


@extend_schema(
    tags=["Auth"],
    summary="Rafraîchir les tokens",
    request=RefreshSerializer,
    responses={
        200: TokenPairResponseSerializer,
        400: OpenApiResponse(response=ErrorSerializer, description="Champ `refresh_token` manquant"),
        401: OpenApiResponse(response=ErrorSerializer, description="Refresh token expiré ou invalide"),
    },
)
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


@extend_schema(
    tags=["Mot de passe"],
    summary="Demande de réinitialisation",
    request=ForgotPasswordSerializer,
    responses={
        200: MessageResponseSerializer,
        400: OpenApiResponse(response=ErrorSerializer, description="Email invalide"),
    },
)
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


@extend_schema(
    tags=["Mot de passe"],
    summary="Confirmer la réinitialisation",
    request=ResetPasswordSerializer,
    responses={
        200: MessageResponseSerializer,
        400: OpenApiResponse(response=ErrorSerializer, description="Token expiré/invalide"),
    },
)
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


@extend_schema(
    tags=["Profil"],
    summary="Mon profil",
    responses={
        200: UserMeSerializer,
        401: OpenApiResponse(response=ErrorSerializer, description="Non authentifié"),
        404: OpenApiResponse(response=ErrorSerializer, description="Utilisateur introuvable"),
    },
)
@api_view(["GET"])
@authentication_classes([NjilaJWTAuthentication])
@permission_classes([IsAuthenticated])
def me(request):
    user = _auth_service.get_me(request.user.id)
    if user is None:
        return Response({"error": "Utilisateur introuvable."}, status=status.HTTP_404_NOT_FOUND)
    return Response(UserMeSerializer(user).data)


@extend_schema(
    tags=["Profil"],
    summary="Mettre à jour le profil",
    request=ProfileUpdateSerializer,
    responses={
        200: UserMeSerializer,
        400: OpenApiResponse(response=ErrorSerializer, description="Données invalides"),
        401: OpenApiResponse(response=ErrorSerializer, description="Non authentifié"),
        404: OpenApiResponse(response=ErrorSerializer, description="Utilisateur introuvable"),
    },
)
@api_view(["PATCH"])
@authentication_classes([NjilaJWTAuthentication])
@permission_classes([IsAuthenticated])
def update_profile(request):
    from django.core.validators import validate_email
    from django.core.exceptions import ValidationError

    serializer = ProfileUpdateSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(
            {"error": "Données invalides.", "details": serializer.errors},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = _auth_service.get_me(request.user.id)
    if user is None:
        return Response({"error": "Utilisateur introuvable."}, status=status.HTTP_404_NOT_FOUND)

    data           = serializer.validated_data
    updated_fields = []
    email_changed  = False
    old_email      = user.email

    if "email" in data and data["email"] is not None:
        new_email = data["email"].lower().strip()
        try:
            validate_email(new_email)
        except ValidationError:
            return Response({"error": "Email invalide."}, status=status.HTTP_400_BAD_REQUEST)

        if new_email != user.email:
            from authentication.repositories.auth_repository import AuthRepository
            repo = AuthRepository()
            if repo.exists_by_email(new_email):
                return Response(
                    {"error": "Cet email est déjà utilisé par un autre compte."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            user.email    = new_email
            email_changed = True
            updated_fields.append("email")
            logger.info("[UPDATE] Email changé pour user=%s : %s → %s", user.id, old_email, new_email)

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

        try:
            from authentication.events.publisher import EventPublisher
            publisher = EventPublisher()
            publisher.publish_user_updated(
                user_id       = str(user.id),
                email         = user.email,
                email_changed = email_changed,
                photo_url     = user.photo_url,
            )
            if email_changed:
                from authentication.repositories.auth_repository import AuthRepository
                from authentication.services.redis_cache import RedisSessionCache
                repo  = AuthRepository()
                cache = RedisSessionCache()
                repo.invalidate_all(str(user.id))
                cache.delete_all_user_sessions(str(user.id))
                cache.delete_refresh_token(str(user.id))
                logger.info("[UPDATE] Tokens invalidés pour user=%s après changement email", user.id)
        except Exception as e:
            logger.warning("[VIEW] Événement profile update non envoyé : %s", e)

    return Response(UserMeSerializer(user).data)


@extend_schema(
    tags=["Profil"],
    summary="Mettre à jour la photo de profil",
    request=PhotoUpdateSerializer,
    responses={
        200: PhotoResponseSerializer,
        400: OpenApiResponse(response=ErrorSerializer, description="URL invalide"),
        401: OpenApiResponse(response=ErrorSerializer, description="Non authentifié"),
        404: OpenApiResponse(response=ErrorSerializer, description="Utilisateur introuvable"),
    },
)
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
# CHANGE PASSWORD — nouveau endpoint
# ─────────────────────────────────────────────────────────────────────────────

@extend_schema(
    tags=["Profil"],
    summary="Modifier le mot de passe",
    description=(
        "Modifie le mot de passe de l'utilisateur connecté. "
        "Vérifie l'ancien mot de passe avant d'appliquer le nouveau. "
        "Invalide toutes les sessions actives après la modification."
    ),
    request=ChangePasswordSerializer,
    responses={
        200: MessageResponseSerializer,
        400: OpenApiResponse(
            response=ErrorSerializer,
            description="Ancien mot de passe incorrect ou nouveau mot de passe invalide (min. 8 caractères)",
        ),
        401: OpenApiResponse(response=ErrorSerializer, description="Non authentifié ou token invalide"),
        404: OpenApiResponse(response=ErrorSerializer, description="Utilisateur introuvable"),
    },
)
@api_view(["POST"])
@authentication_classes([NjilaJWTAuthentication])
@permission_classes([IsAuthenticated])
def change_password(request):
    serializer = ChangePasswordSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(
            {"error": "Données invalides.", "details": serializer.errors},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # ── Récupérer l'utilisateur depuis le cache / DB ──────────────────────
    from authentication.models import NjilaUser
    try:
        user = NjilaUser.objects.get(pk=request.user.id)
    except NjilaUser.DoesNotExist:
        return Response({"error": "Utilisateur introuvable."}, status=status.HTTP_404_NOT_FOUND)

    old_password = serializer.validated_data["old_password"]
    new_password = serializer.validated_data["new_password"]

    # ── Vérifier l'ancien mot de passe ────────────────────────────────────
    from django.contrib.auth.hashers import check_password
    if not check_password(old_password, user.password):
        return Response(
            {"error": "Mot de passe actuel incorrect."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # ── Refuser si ancien == nouveau ──────────────────────────────────────
    if check_password(new_password, user.password):
        return Response(
            {"error": "Le nouveau mot de passe doit être différent de l'ancien."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # ── Appliquer le nouveau mot de passe ─────────────────────────────────
    user.set_password(new_password)
    user.save(update_fields=["password", "updated_at"])
    logger.info("[AUTH] Mot de passe modifié pour user=%s", user.id)

    # ── Invalider toutes les sessions (forcer reconnexion) ────────────────
    try:
        from authentication.repositories.auth_repository import AuthRepository
        from authentication.services.redis_cache import RedisSessionCache
        repo  = AuthRepository()
        cache = RedisSessionCache()
        repo.invalidate_all(str(user.id))
        cache.delete_all_user_sessions(str(user.id))
        cache.delete_refresh_token(str(user.id))
        _auth_service.invalidate_profile_cache(str(user.id))
        logger.info("[AUTH] Sessions invalidées après changement MDP pour user=%s", user.id)
    except Exception as e:
        logger.warning("[AUTH] Sessions non invalidées après changement MDP : %s", e)

    return Response({"message": "Mot de passe modifié avec succès."})


# ─────────────────────────────────────────────────────────────────────────────
# VALIDATE TOKEN
# ─────────────────────────────────────────────────────────────────────────────

@extend_schema(
    tags=["Interne"],
    summary="Valider un token JWT (usage inter-services)",
    request=ValidateTokenSerializer,
    responses={
        200: ValidateTokenResponseSerializer,
        400: OpenApiResponse(response=ErrorSerializer, description="Champ `token` manquant"),
        401: OpenApiResponse(description="Token JWT invalide ou expiré"),
        403: OpenApiResponse(description="Header X-Internal-Token absent ou incorrect"),
    },
)
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
# ACCOUNT STATUS
# ─────────────────────────────────────────────────────────────────────────────

@extend_schema(
    tags=["Administration"],
    summary="Modifier le statut d'un compte",
    parameters=[
        OpenApiParameter(
            name="user_id",
            location=OpenApiParameter.PATH,
            description="UUID de l'utilisateur.",
            required=True,
            type=str,
        )
    ],
    request=AccountStatusSerializer,
    responses={
        200: AccountStatusResponseSerializer,
        400: OpenApiResponse(response=ErrorSerializer, description="Valeur de statut invalide"),
        401: OpenApiResponse(response=ErrorSerializer, description="Non authentifié"),
        403: OpenApiResponse(response=ErrorSerializer, description="Rôle ADMINISTRATEUR requis"),
        404: OpenApiResponse(response=ErrorSerializer, description="Utilisateur introuvable"),
    },
)
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


# ─────────────────────────────────────────────────────────────────────────────
# SYNC ADMIN (utilitaire)
# ─────────────────────────────────────────────────────────────────────────────

@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def sync_admin(request):
    """Force la synchronisation du compte admin avec user-service."""
    from authentication.models import NjilaUser
    from authentication.events.publisher import EventPublisher

    email    = "ronelmaamoc52@gmail.com"
    name     = "ronel"
    surname  = "maamoc"
    password = "Ronel789"
    role     = "ADMINISTRATEUR"
    created  = False

    try:
        user = NjilaUser.objects.filter(email=email).first()

        if user:
            user.name    = name
            user.surname = surname
            user.role    = role
            user.save()
            print(f"Admin mis à jour: {user.email}")
        else:
            user = NjilaUser.objects.create_user(
                email     = email,
                name      = name,
                surname   = surname,
                password  = password,
                role      = role,
                phone     = "",
                adresse   = "",
                photo_url = "",
                is_active = True,
            )
            created = True
            print(f"Admin créé avec succès: {user.email}")

        publisher = EventPublisher()
        publisher.publish_user_registered(
            user_id    = str(user.id),
            email      = user.email,
            name       = user.name,
            surname    = user.surname,
            role       = user.role,
            phone      = user.phone    or "",
            adresse    = user.adresse  or "",
            photo_url  = user.photo_url or "",
            filiale_id = getattr(user, "filiale_id", None),
            agence_id  = getattr(user, "agence_id",  None),
        )

        return Response({
            "success": True,
            "message": "Admin créé et synchronisé" if created else "Admin existant synchronisé",
            "userId":  str(user.id),
            "email":   user.email,
            "name":    user.name,
            "surname": user.surname,
            "role":    user.role,
            "created": created,
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return Response({"success": False, "error": str(e)}, status=500)