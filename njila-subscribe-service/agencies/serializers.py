from rest_framework import serializers
from .models import AgenceMere


class AgenceMereSerializer(serializers.ModelSerializer):
    class Meta:
        model  = AgenceMere
        fields = ["id", "agence_id", "nom", "adresse", "telephone",
                "email_officiel", "statut_global", "date_inscription", "logo_image"]
        read_only_fields = ["id", "date_inscription", "statut_global"]


class AgenceMereCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model  = AgenceMere
        fields = ["agence_id", "nom", "adresse", "telephone", "email_officiel", "logo_image"]
