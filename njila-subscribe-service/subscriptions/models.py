from django.db import models
from agencies.models import AgenceMere


class PlanChoices(models.TextChoices):
    MENSUEL     = "MENSUEL",     "Mensuel"
    TRIMESTRIEL = "TRIMESTRIEL", "Trimestriel"
    ANNUEL      = "ANNUEL",      "Annuel"
    ESSAI       = "ESSAI",       "Essai"


class StatutAbonnement(models.TextChoices):
    EN_ATTENTE = "EN_ATTENTE", "En attente"
    TRIAL      = "TRIAL",      "Essai"
    ACTIVE     = "ACTIVE",     "Actif"
    EXPIRING   = "EXPIRING",   "Expirant"
    EXPIRED    = "EXPIRED",    "Expiré"
    SUSPENDED  = "SUSPENDED",  "Suspendu"
    RESILIATION = "RESILIATION", "Résilié"


class TypeAction(models.TextChoices):
    SOUSCRIPTION  = "SOUSCRIPTION",  "Souscription"
    RENOUVELLEMENT = "RENOUVELLEMENT", "Renouvellement"
    SUSPENSION    = "SUSPENSION",    "Suspension"
    REACTIVATION  = "REACTIVATION",  "Réactivation"
    EXPIRATION    = "EXPIRATION",    "Expiration"
    RESILIATION   = "RESILIATION",   "Résiliation"


class TypeModule(models.TextChoices):
    BOOKING      = "BOOKING",      "Réservations"
    FLEET        = "FLEET",        "Flotte"
    NOTIFICATION = "NOTIFICATION", "Notifications"


PLAN_CONFIG = {
    PlanChoices.ESSAI:       {"duree_jours": 15,  "prix": 0,      "filiales_max": 1,  "modules": ["BOOKING", "SEARCH", "FLEET"]},
    PlanChoices.MENSUEL:     {"duree_jours": 30,  "prix": 50000,  "filiales_max": 3,  "modules": ["BOOKING", "SEARCH", "FLEET", "NOTIFICATION"]},
    PlanChoices.TRIMESTRIEL: {"duree_jours": 90,  "prix": 130000, "filiales_max": 5,  "modules": ["BOOKING", "SEARCH", "FLEET", "NOTIFICATION", "REPORTING"]},
    PlanChoices.ANNUEL:      {"duree_jours": 365, "prix": 450000, "filiales_max": -1, "modules": ["BOOKING", "SEARCH", "FLEET", "NOTIFICATION", "REPORTING"]},
}


class Abonnement(models.Model):
    agence                 = models.ForeignKey(AgenceMere, on_delete=models.CASCADE, related_name="abonnements")
    id_agence              = models.CharField(max_length=100)
    plan                   = models.CharField(max_length=20, choices=PlanChoices.choices)
    date_debut             = models.DateTimeField()
    date_expiration        = models.DateTimeField()
    statut                 = models.CharField(max_length=20, choices=StatutAbonnement.choices, default=StatutAbonnement.EN_ATTENTE)
    cle_activation_hash    = models.TextField(blank=True, default="")
    id_transaction_paiement = models.CharField(max_length=255, blank=True, default="")

    class Meta:
        db_table = "abonnements"
        ordering = ["-date_debut"]

    def est_actif(self):
        return self.statut in [StatutAbonnement.ACTIVE, StatutAbonnement.TRIAL, StatutAbonnement.EXPIRING]

    def est_expire(self):
        from django.utils import timezone
        return self.date_expiration < timezone.now()

    def jours_restants(self):
        from django.utils import timezone
        return max(0, (self.date_expiration - timezone.now()).days)


class SubscriptionKey(models.Model):
    abonnement     = models.OneToOneField(Abonnement, on_delete=models.CASCADE, related_name="subscription_key")
    cle_publique   = models.TextField()
    fingerprint    = models.CharField(max_length=64)
    date_generation = models.DateTimeField(auto_now_add=True)
    actif          = models.BooleanField(default=True)

    class Meta:
        db_table = "subscription_keys"


class CleActivation(models.Model):
    abonnement      = models.ForeignKey(Abonnement, on_delete=models.CASCADE, related_name="cles_activation")
    cle_chiffree    = models.TextField()
    date_generation = models.DateTimeField(auto_now_add=True)
    date_expiration = models.DateTimeField()
    revoquee        = models.BooleanField(default=False)
    nonce           = models.CharField(max_length=64)

    class Meta:
        db_table = "cles_activation"

    def est_valide(self):
        from django.utils import timezone
        return not self.revoquee and self.date_expiration > timezone.now()

    def revoquer(self):
        self.revoquee = True
        self.save(update_fields=["revoquee"])


class ModuleAutorise(models.Model):
    abonnement = models.ForeignKey(Abonnement, on_delete=models.CASCADE, related_name="modules")
    nom_module = models.CharField(max_length=30, choices=TypeModule.choices)
    actif      = models.BooleanField(default=True)

    class Meta:
        db_table      = "modules_autorises"
        unique_together = ("abonnement", "nom_module")


class HistoriqueAbonnement(models.Model):
    abonnement  = models.ForeignKey(Abonnement, on_delete=models.CASCADE, related_name="historique")
    id_agence   = models.CharField(max_length=100)
    action      = models.CharField(max_length=30, choices=TypeAction.choices)
    date_action = models.DateTimeField(auto_now_add=True)
    details     = models.TextField(blank=True, default="")
    id_operateur = models.CharField(max_length=100, default="SYSTEM")

    class Meta:
        db_table = "historique_abonnements"
        ordering = ["-date_action"]

    @classmethod
    def ajouter_trace(cls, abonnement, action, details="", operateur="SYSTEM"):
        return cls.objects.create(
            abonnement=abonnement, id_agence=abonnement.id_agence,
            action=action, details=details, id_operateur=operateur,
        )


class AlerteExpiration(models.Model):
    abonnement    = models.ForeignKey(Abonnement, on_delete=models.CASCADE, related_name="alertes")
    type_alerte   = models.CharField(max_length=10)
    date_envoi    = models.DateTimeField(auto_now_add=True)
    statut_envoi  = models.CharField(max_length=20, default="ENVOYE")
    jours_restants = models.IntegerField(default=0)

    class Meta:
        db_table = "alertes_expiration"