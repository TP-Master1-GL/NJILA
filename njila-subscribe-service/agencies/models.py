from django.db import models


class AgenceMere(models.Model):
    agence_id       = models.CharField(max_length=100, unique=True)
    nom             = models.CharField(max_length=255)
    adresse         = models.TextField(blank=True, default="")
    telephone       = models.CharField(max_length=30, blank=True, default="")
    email_officiel  = models.EmailField(unique=True)
    statut_global   = models.CharField(max_length=20, default="EN_ATTENTE")
    date_inscription = models.DateTimeField(auto_now_add=True)
    logo_image      = models.CharField(max_length=500, blank=True, default="")

    class Meta:
        db_table = "agences"

    def __str__(self):
        return f"{self.nom} ({self.agence_id})"