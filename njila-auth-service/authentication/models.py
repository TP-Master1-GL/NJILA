import uuid
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager
from django.db import models


class DeactivationReason:
    SUBSCRIPTION_EXPIRED = "SUBSCRIPTION_EXPIRED"
    ADMIN_SUSPENDED      = "ADMIN_SUSPENDED"


class Role(models.TextChoices):
    VOYAGEUR       = "VOYAGEUR",       "Voyageur"
    GUICHETIER     = "GUICHETIER",     "Guichetier"
    MANAGER_LOCAL  = "MANAGER_LOCAL",  "Manager local"
    MANAGER_GLOBAL = "MANAGER_GLOBAL", "Manager global"
    ADMINISTRATEUR = "ADMINISTRATEUR", "Administrateur"
    CHAUFFEUR      = "CHAUFFEUR",      "Chauffeur"

ROLES_LINKED_TO_AGENCE = {
    Role.GUICHETIER,
    Role.MANAGER_LOCAL,
    Role.MANAGER_GLOBAL,
    Role.CHAUFFEUR,
}


class NjilaUserManager(BaseUserManager):

    def create_user(self, email, password=None, role=Role.VOYAGEUR, **extra_fields):
        if not email:
            raise ValueError("L'email est obligatoire.")
        email = self.normalize_email(email)
        user  = self.model(email=email, role=role, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("role",      Role.ADMINISTRATEUR)
        extra_fields.setdefault("is_staff",  True)
        extra_fields.setdefault("is_active", True)
        return self.create_user(email, password, **extra_fields)


class NjilaUser(AbstractBaseUser):

    id    = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # ── Identité — alignée avec UserProfile (user-service) ────────────────────
    email   = models.EmailField(unique=True, db_index=True)
    name    = models.CharField(max_length=100, blank=True, default="")
    surname = models.CharField(max_length=100, blank=True, default="")
    phone   = models.CharField(max_length=20,  null=True,  blank=True)
    adresse = models.TextField(null=True, blank=True)

    photo_url = models.CharField(max_length=500, null=True, blank=True)

    role = models.CharField(
        max_length=20, choices=Role.choices, default=Role.VOYAGEUR
    )
    filiale_id = models.UUIDField(null=True, blank=True, db_index=True)
    agence_id  = models.UUIDField(null=True, blank=True, db_index=True)

    is_active   = models.BooleanField(default=True)
    is_verified = models.BooleanField(default=False)
    is_staff    = models.BooleanField(default=False)

    deactivation_reason = models.CharField(max_length=30, null=True, blank=True)

    failed_attempts = models.PositiveSmallIntegerField(default=0)
    locked_until    = models.DateTimeField(null=True, blank=True)

    last_login_at = models.DateTimeField(null=True, blank=True)
    created_at    = models.DateTimeField(auto_now_add=True)
    updated_at    = models.DateTimeField(auto_now=True)
    created_by    = models.CharField(max_length=10, default="SELF")

    objects = NjilaUserManager()

    USERNAME_FIELD  = "email"
    REQUIRED_FIELDS = []

    
    @property
    def full_name(self) -> str:
        """Retourne 'name surname' ou l'email si les deux sont vides."""
        parts = [self.name, self.surname]
        full  = " ".join(p for p in parts if p)
        return full if full else self.email

    def activate(self):
        self.is_active           = True
        self.is_verified         = True
        self.deactivation_reason = None
        self.save(update_fields=["is_active", "is_verified", "deactivation_reason", "updated_at"])

    def deactivate(self, reason: str = DeactivationReason.ADMIN_SUSPENDED):
        self.is_active           = False
        self.deactivation_reason = reason
        self.save(update_fields=["is_active", "deactivation_reason", "updated_at"])

    def is_locked(self) -> bool:
        from django.utils import timezone
        return bool(self.locked_until and self.locked_until > timezone.now())

    def increment_failed_attempts(self):
        from django.utils import timezone
        from datetime import timedelta
        self.failed_attempts += 1
        if self.failed_attempts >= 5:
            self.locked_until = timezone.now() + timedelta(minutes=15)
        self.save(update_fields=["failed_attempts", "locked_until", "updated_at"])

    def reset_failed_attempts(self):
        self.failed_attempts = 0
        self.locked_until    = None
        self.save(update_fields=["failed_attempts", "locked_until", "updated_at"])

    def is_linked_to_agence(self) -> bool:
        return self.role in ROLES_LINKED_TO_AGENCE

    def get_inactive_message(self) -> str:
        if self.deactivation_reason == DeactivationReason.SUBSCRIPTION_EXPIRED:
            return (
                "L'abonnement de votre agence est expiré. "
                "Veuillez contacter votre manager pour le renouveler."
            )
        return "Ce compte est désactivé ou suspendu. Contactez l'administrateur."

    def __str__(self):
        return f"[{self.role}] {self.full_name} <{self.email}>"

    class Meta:
        db_table     = "auth_users"
        verbose_name = "Utilisateur NJILA"
        indexes = [
            models.Index(fields=["agence_id", "is_active"], name="auth_users_agence_active_idx"),
            models.Index(fields=["agence_id", "role"],      name="auth_users_agence_role_idx"),
        ]


class AuthSession(models.Model):
    session_id    = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user          = models.ForeignKey(
        NjilaUser, on_delete=models.CASCADE, related_name="sessions"
    )
    access_token  = models.TextField()
    refresh_token = models.TextField()
    expires_at    = models.DateTimeField()
    is_active     = models.BooleanField(default=True)
    created_at    = models.DateTimeField(auto_now_add=True)
    ip_address    = models.GenericIPAddressField(null=True, blank=True)
    user_agent    = models.TextField(blank=True)

    def is_expired(self) -> bool:
        from django.utils import timezone
        return self.expires_at < timezone.now()

    def invalidate(self):
        self.is_active = False
        self.save(update_fields=["is_active"])

    def __str__(self):
        return f"Session {self.session_id} — {self.user.email}"

    class Meta:
        db_table = "auth_sessions"
        indexes  = [models.Index(fields=["user", "is_active"])]


class PasswordResetToken(models.Model):
    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user       = models.ForeignKey(NjilaUser, on_delete=models.CASCADE)
    token      = models.CharField(max_length=255, unique=True, db_index=True)
    expires_at = models.DateTimeField()
    used       = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def is_valid(self) -> bool:
        from django.utils import timezone
        return not self.used and self.expires_at > timezone.now()

    class Meta:
        db_table = "auth_password_reset_tokens"