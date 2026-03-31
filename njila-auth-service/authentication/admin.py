from django.contrib import admin
from authentication.models import AuthSession, NjilaUser, PasswordResetToken


@admin.register(NjilaUser)
class NjilaUserAdmin(admin.ModelAdmin):
    list_display    = ("email", "role", "is_active", "is_verified",
                       "filiale_id", "failed_attempts", "created_at")
    list_filter     = ("role", "is_active", "is_verified", "created_by")
    search_fields   = ("email",)
    ordering        = ("-created_at",)
    readonly_fields = ("created_at", "updated_at", "last_login_at")
    fieldsets = (
        ("Identifiants", {"fields": ("email", "password")}),
        ("Rôle & Contexte", {"fields": ("role", "filiale_id", "agence_id")}),
        ("Statut", {"fields": ("is_active", "is_verified", "is_staff",
                               "failed_attempts", "locked_until")}),
        ("Audit", {"fields": ("last_login_at", "created_at", "updated_at", "created_by")}),
    )
    add_fieldsets = (
        ("Créer un compte", {
            "classes": ("wide",),
            "fields":  ("email", "password", "role",
                        "filiale_id", "agence_id", "is_active"),
        }),
    )


@admin.register(AuthSession)
class AuthSessionAdmin(admin.ModelAdmin):
    list_display    = ("session_id", "user_email", "is_active", "expires_at", "created_at")
    list_filter     = ("is_active",)
    search_fields   = ("user__email",)
    ordering        = ("-created_at",)
    readonly_fields = ("session_id", "created_at")

    def user_email(self, obj):
        return obj.user.email
    user_email.short_description = "Utilisateur"

    def has_add_permission(self, request):
        return False


@admin.register(PasswordResetToken)
class PasswordResetTokenAdmin(admin.ModelAdmin):
    list_display    = ("id", "user_email", "used", "expires_at", "created_at")
    list_filter     = ("used",)
    search_fields   = ("user__email",)
    readonly_fields = ("id", "token", "created_at")

    def user_email(self, obj):
        return obj.user.email
    user_email.short_description = "Utilisateur"

    def has_add_permission(self, request):
        return False