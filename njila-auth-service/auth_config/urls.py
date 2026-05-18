from django.urls import path
from authentication import views
from .health import health_check
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularSwaggerView,
    SpectacularRedocView,
)

urlpatterns = [

    # ── Auth ──────────────────────────────────────────────────────────────────
    path("api/auth/register",        views.register,        name="auth-register"),
    path("api/auth/login",           views.login,           name="auth-login"),
    path("api/auth/logout",          views.logout,          name="auth-logout"),
    path("api/auth/refresh",         views.refresh_token,   name="auth-refresh"),

    # ── Profil ────────────────────────────────────────────────────────────────
    path("api/auth/me",              views.me,              name="auth-me"),
    path("api/auth/me/profile",      views.update_profile,  name="auth-update-profile"),
    path("api/auth/me/photo",        views.update_photo,    name="auth-update-photo"),

    # ── Mot de passe ──────────────────────────────────────────────────────────
    path("api/auth/change-password", views.change_password, name="auth-change-password"),
    path("api/auth/forgot-password", views.forgot_password, name="auth-forgot-password"),
    path("api/auth/reset-password",  views.reset_password,  name="auth-reset-password"),

    # ── Interne / Admin ───────────────────────────────────────────────────────
    path("api/auth/validate-token",  views.validate_token,  name="auth-validate-token"),
    path("api/auth/users/<str:user_id>/status",
         views.account_status,                              name="auth-account-status"),
    path("api/auth/sync-admin",      views.sync_admin,      name="auth-sync-admin"),

    # ── Health ────────────────────────────────────────────────────────────────
    path("api/auth/health",          views.health,          name="auth-health"),
    path("health/",                  health_check,          name="health_check"),

    # ── Documentation Swagger / Redoc ─────────────────────────────────────────
    path("api/schema/",     SpectacularAPIView.as_view(),                          name="schema"),
    path("api/docs/",       SpectacularSwaggerView.as_view(url_name="schema"),     name="swagger-ui"),
    path("api/docs/redoc/", SpectacularRedocView.as_view(url_name="schema"),       name="redoc"),
]