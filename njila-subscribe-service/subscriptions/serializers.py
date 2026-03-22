from rest_framework import serializers
from .models import Abonnement, SubscriptionKey, CleActivation, ModuleAutorise, HistoriqueAbonnement, AlerteExpiration


class ModuleAutoriseSerializer(serializers.ModelSerializer):
    class Meta:
        model  = ModuleAutorise
        fields = ["id", "nom_module", "actif"]


class SubscriptionKeySerializer(serializers.ModelSerializer):
    class Meta:
        model  = SubscriptionKey
        fields = ["id", "fingerprint", "date_generation", "actif"]


class CleActivationSerializer(serializers.ModelSerializer):
    class Meta:
        model  = CleActivation
        fields = ["id", "date_generation", "date_expiration", "revoquee", "nonce"]


class HistoriqueAbonnementSerializer(serializers.ModelSerializer):
    class Meta:
        model  = HistoriqueAbonnement
        fields = ["id", "action", "date_action", "details", "id_operateur"]


class AlerteExpirationSerializer(serializers.ModelSerializer):
    class Meta:
        model  = AlerteExpiration
        fields = ["id", "type_alerte", "date_envoi", "statut_envoi", "jours_restants"]


class AbonnementSerializer(serializers.ModelSerializer):
    modules        = ModuleAutoriseSerializer(many=True, read_only=True)
    jours_restants = serializers.SerializerMethodField()

    class Meta:
        model  = Abonnement
        fields = ["id", "id_agence", "plan", "date_debut", "date_expiration",
                "statut", "id_transaction_paiement", "modules", "jours_restants"]

    def get_jours_restants(self, obj):
        return obj.jours_restants()


class AbonnementDetailSerializer(AbonnementSerializer):
    subscription_key = SubscriptionKeySerializer(read_only=True)
    historique       = HistoriqueAbonnementSerializer(many=True, read_only=True)
    alertes          = AlerteExpirationSerializer(many=True, read_only=True)

    class Meta(AbonnementSerializer.Meta):
        fields = AbonnementSerializer.Meta.fields + ["subscription_key", "historique", "alertes"]


class SouscrireSerializer(serializers.Serializer):
    plan                    = serializers.ChoiceField(choices=["MENSUEL", "TRIMESTRIEL", "ANNUEL", "ESSAI"])
    id_transaction_paiement = serializers.CharField(required=False, allow_blank=True, default="")


class RenouvelerSerializer(serializers.Serializer):
    plan                    = serializers.ChoiceField(choices=["MENSUEL", "TRIMESTRIEL", "ANNUEL"])
    id_transaction_paiement = serializers.CharField(required=False, allow_blank=True, default="")


class SuspendreSerializer(serializers.Serializer):
    motif    = serializers.CharField(max_length=500)
    admin_id = serializers.CharField(max_length=100)


class ReactiverSerializer(serializers.Serializer):
    plan                    = serializers.ChoiceField(choices=["MENSUEL", "TRIMESTRIEL", "ANNUEL"], required=False)
    id_transaction_paiement = serializers.CharField(required=False, allow_blank=True, default="")
