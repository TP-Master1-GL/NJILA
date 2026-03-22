import logging
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from .models import AgenceMere
from .serializers import AgenceMereSerializer, AgenceMereCreateSerializer
from subscriptions.models import Abonnement, PLAN_CONFIG
from subscriptions.serializers import (
    AbonnementDetailSerializer, SouscrireSerializer,
    RenouvelerSerializer, SuspendreSerializer, ReactiverSerializer,
)
from subscriptions.service import SubscriptionService

logger = logging.getLogger(__name__)


def _get_agence_or_404(agence_id: str):
    try:
        return AgenceMere.objects.get(agence_id=agence_id), None
    except AgenceMere.DoesNotExist:
        return None, Response({"detail": "Agence introuvable."}, status=status.HTTP_404_NOT_FOUND)


def _get_last_abonnement(agence):
    ab = Abonnement.objects.filter(agence=agence).order_by("-date_debut").first()
    if not ab:
        return None, Response({"detail": "Aucun abonnement trouvé."}, status=status.HTTP_404_NOT_FOUND)
    return ab, None


class AgenceListCreateView(APIView):
    def get(self, request):
        return Response(AgenceMereSerializer(AgenceMere.objects.all(), many=True).data)

    def post(self, request):
        s = AgenceMereCreateSerializer(data=request.data)
        if not s.is_valid():
            return Response(s.errors, status=status.HTTP_400_BAD_REQUEST)
        return Response(AgenceMereSerializer(s.save()).data, status=status.HTTP_201_CREATED)


class AgenceDetailView(APIView):
    def get(self, request, agence_id):
        agence, err = _get_agence_or_404(agence_id)
        if err: return err
        data = AgenceMereSerializer(agence).data
        ab   = Abonnement.objects.filter(agence=agence).order_by("-date_debut").first()
        if ab:
            data["abonnement_actuel"] = AbonnementDetailSerializer(ab).data
        return Response(data)


class SouscrireView(APIView):
    def post(self, request, agence_id):
        agence, err = _get_agence_or_404(agence_id)
        if err: return err
        s = SouscrireSerializer(data=request.data)
        if not s.is_valid():
            return Response(s.errors, status=status.HTTP_400_BAD_REQUEST)
        result = SubscriptionService.souscrire(
            agence, s.validated_data["plan"],
            s.validated_data.get("id_transaction_paiement", ""),
        )
        data = AbonnementDetailSerializer(result["abonnement"]).data
        data["cle_privee_pem"] = result["cle_privee_pem"]
        data["cle_chiffree"]   = result["cle_chiffree"]
        data["avertissement"]  = (
            "Clé privée à envoyer par email sécurisé à l'agence "
            "et à supprimer définitivement des serveurs NJILA."
        )
        return Response(data, status=status.HTTP_201_CREATED)


class RenouvelerView(APIView):
    def post(self, request, agence_id):
        agence, err = _get_agence_or_404(agence_id)
        if err: return err
        ab, err = _get_last_abonnement(agence)
        if err: return err
        s = RenouvelerSerializer(data=request.data)
        if not s.is_valid():
            return Response(s.errors, status=status.HTTP_400_BAD_REQUEST)
        result = SubscriptionService.renouveler(
            ab, s.validated_data["plan"],
            s.validated_data.get("id_transaction_paiement", ""),
        )
        return Response(AbonnementDetailSerializer(result["abonnement"]).data)


class SuspendreView(APIView):
    def post(self, request, agence_id):
        agence, err = _get_agence_or_404(agence_id)
        if err: return err
        ab, err = _get_last_abonnement(agence)
        if err: return err
        s = SuspendreSerializer(data=request.data)
        if not s.is_valid():
            return Response(s.errors, status=status.HTTP_400_BAD_REQUEST)
        ab = SubscriptionService.suspendre(ab, s.validated_data["motif"], s.validated_data["admin_id"])
        return Response(AbonnementDetailSerializer(ab).data)


class ReactiverView(APIView):
    def post(self, request, agence_id):
        agence, err = _get_agence_or_404(agence_id)
        if err: return err
        ab, err = _get_last_abonnement(agence)
        if err: return err
        s = ReactiverSerializer(data=request.data)
        if not s.is_valid():
            return Response(s.errors, status=status.HTTP_400_BAD_REQUEST)
        result = SubscriptionService.reactiver(
            ab, s.validated_data.get("plan"),
            s.validated_data.get("id_transaction_paiement", ""),
        )
        return Response(AbonnementDetailSerializer(result["abonnement"]).data)


class MonAbonnementView(APIView):
    def get(self, request, agence_id):
        agence, err = _get_agence_or_404(agence_id)
        if err: return err
        ab, err = _get_last_abonnement(agence)
        if err: return err
        data = AbonnementDetailSerializer(ab).data
        cfg  = PLAN_CONFIG.get(ab.plan, {})
        data["filiales_max"] = cfg.get("filiales_max", 0)
        return Response(data)


class DemandeEssaiView(APIView):
    def post(self, request, agence_id):
        agence, err = _get_agence_or_404(agence_id)
        if err: return err
        if Abonnement.objects.filter(agence=agence, plan="ESSAI").exists():
            return Response({"detail": "Essai déjà utilisé."}, status=status.HTTP_400_BAD_REQUEST)
        result = SubscriptionService.souscrire(agence, "ESSAI")
        data = AbonnementDetailSerializer(result["abonnement"]).data
        data["cle_privee_pem"] = result["cle_privee_pem"]
        data["avertissement"]  = "Clé privée à envoyer par email. Valable 15 jours."
        return Response(data, status=status.HTTP_201_CREATED)