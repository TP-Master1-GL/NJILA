from datetime import timedelta
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from agencies.models import AgenceMere
from .models import Abonnement, StatutAbonnement, PLAN_CONFIG
from .serializers import AbonnementSerializer
from core.cache.subscription_cache_manager import SubscriptionCacheManager


class VerifyAbonnementView(APIView):
    """GET /api/subscribe/verify/{agenceId} — appelé par le proxy-service (cache miss)"""

    def get(self, request, agence_id):
        if SubscriptionCacheManager.est_bloque(agence_id):
            return Response({"agenceId": agence_id, "statut": "SUSPENDED", "source": "redis"})

        ab = Abonnement.objects.filter(id_agence=agence_id).order_by("-date_debut").first()
        if not ab:
            return Response({"agenceId": agence_id, "statut": "NOT_FOUND"}, status=404)

        if ab.est_expire() and ab.statut not in [StatutAbonnement.EXPIRED, StatutAbonnement.SUSPENDED]:
            ab.statut = StatutAbonnement.EXPIRED
            ab.save(update_fields=["statut"])

        modules = [m.nom_module for m in ab.modules.filter(actif=True)]
        ttl     = max(60, int((ab.date_expiration - timezone.now()).total_seconds()))
        SubscriptionCacheManager.mettre_a_jour_statut(agence_id, ab.statut, ttl, modules, ab.date_expiration.isoformat())

        return Response({
            "agenceId":      agence_id,
            "statut":        ab.statut,
            "plan":          ab.plan,
            "dateExpiration": ab.date_expiration.isoformat(),
            "joursRestants": ab.jours_restants(),
            "modules":       modules,
            "source":        "database",
        })


class ModulesAgenceView(APIView):
    """GET /api/subscribe/modules/{agenceId}"""

    def get(self, request, agence_id):
        modules = SubscriptionCacheManager.lire_modules(agence_id)
        if modules is not None:
            return Response({"agenceId": agence_id, "modules": modules, "source": "redis"})

        ab = Abonnement.objects.filter(id_agence=agence_id).order_by("-date_debut").first()
        if not ab or not ab.est_actif():
            return Response({"agenceId": agence_id, "modules": [], "statut": "INACTIF"})

        modules = [m.nom_module for m in ab.modules.filter(actif=True)]
        return Response({"agenceId": agence_id, "modules": modules, "source": "database"})


class TableauDeBordView(APIView):
    """GET /api/subscribe/tableau-de-bord"""

    def get(self, request):
        now    = timezone.now()
        dans30 = now + timedelta(days=30)

        recettes = {
            plan: Abonnement.objects.filter(statut=StatutAbonnement.ACTIVE, plan=plan).count() * cfg["prix"]
            for plan, cfg in PLAN_CONFIG.items() if plan != "ESSAI"
        }

        expirant = Abonnement.objects.filter(
            statut__in=[StatutAbonnement.ACTIVE, StatutAbonnement.TRIAL],
            date_expiration__lte=dans30, date_expiration__gt=now,
        ).select_related("agence").order_by("date_expiration")

        return Response({
            "resume": {
                "actifs":           Abonnement.objects.filter(statut=StatutAbonnement.ACTIVE).count(),
                "essais":           Abonnement.objects.filter(statut=StatutAbonnement.TRIAL).count(),
                "expirant_sous_30j": expirant.count(),
                "expires":          Abonnement.objects.filter(statut=StatutAbonnement.EXPIRED).count(),
                "suspendus":        Abonnement.objects.filter(statut=StatutAbonnement.SUSPENDED).count(),
                "recette_totale_fcfa": sum(recettes.values()),
                "recettes_par_plan":   recettes,
            },
            "abonnements_expirant_bientot": AbonnementSerializer(expirant, many=True).data,
        })