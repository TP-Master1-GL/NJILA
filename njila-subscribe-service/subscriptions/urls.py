from django.urls import path
from .views import VerifyAbonnementView, ModulesAgenceView, TableauDeBordView

urlpatterns = [
    path("verify/<str:agence_id>",  VerifyAbonnementView.as_view()),
    path("modules/<str:agence_id>", ModulesAgenceView.as_view()),
    path("tableau-de-bord",         TableauDeBordView.as_view()),
]