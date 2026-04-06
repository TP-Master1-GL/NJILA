"""
Sérialiseurs DRF — auth-service NJILA v1.3

Modifications v1.3 :
  - RegisterSerializer : name, surname obligatoires + phone, adresse optionnels
    (remplacement de nom/prenom par name/surname — alignement UserProfile)
  - UserMeSerializer   : name, surname, phone, adresse ajoutés
"""

from rest_framework import serializers
from authentication.models import Role


class RegisterSerializer(serializers.Serializer):
    email   = serializers.EmailField()
    password = serializers.CharField(min_length=8, write_only=True)

    # Données d'identité — alignées avec UserProfile (user-service)
    name    = serializers.CharField(max_length=100)             # prénom
    surname = serializers.CharField(max_length=100)             # nom de famille
    phone   = serializers.CharField(max_length=20,  required=False, allow_null=True, default=None)
    adresse = serializers.CharField(max_length=500, required=False, allow_null=True, default=None)

    role = serializers.ChoiceField(
        choices=[c[0] for c in Role.choices], default=Role.VOYAGEUR,
    )
    photo_url  = serializers.URLField(required=False, allow_null=True, default=None)
    filiale_id = serializers.UUIDField(required=False, allow_null=True, default=None)
    agence_id  = serializers.UUIDField(required=False, allow_null=True, default=None)

    def validate_password(self, value):
        if len(value) < 8:
            raise serializers.ValidationError(
                "Le mot de passe doit contenir au moins 8 caractères."
            )
        return value

    def validate_name(self, value):
        if not value.strip():
            raise serializers.ValidationError("Le prénom ne peut pas être vide.")
        return value.strip()

    def validate_surname(self, value):
        if not value.strip():
            raise serializers.ValidationError("Le nom ne peut pas être vide.")
        return value.strip()


class LoginSerializer(serializers.Serializer):
    email    = serializers.EmailField()
    password = serializers.CharField(write_only=True)


class RefreshSerializer(serializers.Serializer):
    refresh_token = serializers.CharField()


class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()


class ResetPasswordSerializer(serializers.Serializer):
    token        = serializers.CharField()
    new_password = serializers.CharField(min_length=8, write_only=True)

    def validate_new_password(self, value):
        if len(value) < 8:
            raise serializers.ValidationError(
                "Le mot de passe doit contenir au moins 8 caractères."
            )
        return value


class ValidateTokenSerializer(serializers.Serializer):
    token = serializers.CharField()


class AccountStatusSerializer(serializers.Serializer):
    STATUS_CHOICES = [("active", "Actif"), ("inactive", "Inactif"), ("suspended", "Suspendu")]
    status = serializers.ChoiceField(choices=STATUS_CHOICES)


class PhotoUpdateSerializer(serializers.Serializer):
    """PATCH /api/auth/me/photo — mise à jour de la photo de profil."""
    photo_url = serializers.URLField(max_length=500)

    def validate_photo_url(self, value):
        if not value.startswith("https://"):
            raise serializers.ValidationError("L'URL de la photo doit utiliser HTTPS.")
        return value


class ProfileUpdateSerializer(serializers.Serializer):
    """
    PATCH /api/auth/me — mise à jour des données de profil.
    Tous les champs sont optionnels (PATCH partiel).
    """
    name    = serializers.CharField(max_length=100, required=False)
    surname = serializers.CharField(max_length=100, required=False)
    phone   = serializers.CharField(max_length=20,  required=False, allow_null=True)
    adresse = serializers.CharField(max_length=500, required=False, allow_null=True)

    def validate_name(self, value):
        if value and not value.strip():
            raise serializers.ValidationError("Le prénom ne peut pas être vide.")
        return value.strip() if value else value

    def validate_surname(self, value):
        if value and not value.strip():
            raise serializers.ValidationError("Le nom ne peut pas être vide.")
        return value.strip() if value else value


# ── Réponses ──────────────────────────────────────────────────────────────────
class UserMeSerializer(serializers.Serializer):
    """Réponse GET /api/auth/me — profil complet de l'utilisateur connecté."""
    id          = serializers.UUIDField()
    email       = serializers.EmailField()
    # Données d'identité
    name        = serializers.CharField()
    surname     = serializers.CharField()
    phone       = serializers.CharField(allow_null=True)
    adresse     = serializers.CharField(allow_null=True)
    photo_url   = serializers.URLField(allow_null=True)
    # Contexte organisationnel
    role        = serializers.CharField()
    filiale_id  = serializers.UUIDField(allow_null=True)
    agence_id   = serializers.UUIDField(allow_null=True)
    # Flags
    is_active   = serializers.BooleanField()
    is_verified = serializers.BooleanField()
    # Audit
    created_at    = serializers.DateTimeField()
    last_login_at = serializers.DateTimeField(allow_null=True)