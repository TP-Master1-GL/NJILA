from rest_framework import serializers
from authentication.models import Role
import uuid


class RegisterSerializer(serializers.Serializer):
    email   = serializers.EmailField()
    password = serializers.CharField(min_length=8, write_only=True)

    name    = serializers.CharField(max_length=100)            
    surname = serializers.CharField(max_length=100)            
    phone   = serializers.CharField(max_length=20, required=False, allow_blank=True, allow_null=True, default=None)
    adresse = serializers.CharField(max_length=500, required=False, allow_blank=True, allow_null=True, default=None)

    role = serializers.ChoiceField(
        choices=[c[0] for c in Role.choices], default=Role.VOYAGEUR,
    )
    photo_url  = serializers.CharField(required=False, allow_blank=True, allow_null=True, default=None)
    filiale_id = serializers.CharField(required=False, allow_blank=True, allow_null=True, default=None)
    agence_id  = serializers.CharField(required=False, allow_blank=True, allow_null=True, default=None)

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

    def validate_filiale_id(self, value):
        """Convertit les chaînes vides en None et valide les UUID"""
        if not value or value == "":
            return None
        try:
            uuid.UUID(value)
            return value
        except ValueError:
            raise serializers.ValidationError("Format d'UUID invalide.")

    def validate_agence_id(self, value):
        """Convertit les chaînes vides en None et valide les UUID"""
        if not value or value == "":
            return None
        try:
            uuid.UUID(value)
            return value
        except ValueError:
            raise serializers.ValidationError("Format d'UUID invalide.")


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
    photo_url = serializers.CharField(max_length=500)

    def validate_photo_url(self, value):
        return value


class ProfileUpdateSerializer(serializers.Serializer):
    # AJOUT du champ email
    email   = serializers.EmailField(required=False, allow_null=True)
    name    = serializers.CharField(max_length=100, required=False, allow_null=True)
    surname = serializers.CharField(max_length=100, required=False, allow_null=True)
    phone   = serializers.CharField(max_length=20,  required=False, allow_null=True)
    adresse = serializers.CharField(max_length=500, required=False, allow_null=True)

    def validate_email(self, value):
        """Validation optionnelle de l'email"""
        if value is not None:
            # Si l'email est fourni, on le nettoie
            return value.lower().strip()
        return value

    def validate_name(self, value):
        if value and not value.strip():
            raise serializers.ValidationError("Le prénom ne peut pas être vide.")
        return value.strip() if value else value

    def validate_surname(self, value):
        if value and not value.strip():
            raise serializers.ValidationError("Le nom ne peut pas être vide.")
        return value.strip() if value else value


class UserMeSerializer(serializers.Serializer):
    id          = serializers.UUIDField()
    email       = serializers.EmailField()
    name        = serializers.CharField()
    surname     = serializers.CharField()
    phone       = serializers.CharField(allow_null=True)
    adresse     = serializers.CharField(allow_null=True)
    photo_url   = serializers.CharField(allow_null=True)
    role        = serializers.CharField()
    filiale_id  = serializers.UUIDField(allow_null=True)
    agence_id   = serializers.UUIDField(allow_null=True)
    is_active   = serializers.BooleanField()
    is_verified = serializers.BooleanField()
    created_at    = serializers.DateTimeField()
    last_login_at = serializers.DateTimeField(allow_null=True)