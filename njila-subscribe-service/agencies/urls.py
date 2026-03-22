from django.urls import path
from .views import (
    AgenceListCreateView, AgenceDetailView,
    SouscrireView, RenouvelerView, SuspendreView,
    ReactiverView, MonAbonnementView, DemandeEssaiView,
)

urlpatterns = [
    path("agences",                             AgenceListCreateView.as_view()),
    path("agences/<str:agence_id>",             AgenceDetailView.as_view()),
    path("agences/<str:agence_id>/souscrire",   SouscrireView.as_view()),
    path("agences/<str:agence_id>/renouveler",  RenouvelerView.as_view()),
    path("agences/<str:agence_id>/suspendre",   SuspendreView.as_view()),
    path("agences/<str:agence_id>/reactiver",   ReactiverView.as_view()),
    path("agences/<str:agence_id>/mon-abonnement", MonAbonnementView.as_view()),
    path("agences/<str:agence_id>/demande-essai",  DemandeEssaiView.as_view()),
]