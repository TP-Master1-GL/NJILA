import logging
from datetime import timedelta

from django.utils import timezone
from django.db import transaction

from agencies.models import AgenceMere
from .models import (
    Abonnement, StatutAbonnement, PlanChoices, PLAN_CONFIG,
    SubscriptionKey, CleActivation, ModuleAutorise, HistoriqueAbonnement, TypeAction,
)
from core.crypto.rsa_service import (
    generate_rsa_keypair, get_public_key_fingerprint,
    build_activation_payload, encrypt_activation_key,
)
from core.cache.subscription_cache_manager import SubscriptionCacheManager
from core.tasks.rabbitmq_publisher import publier_activated, publier_suspended

logger = logging.getLogger(__name__)


class SubscriptionService:

    @staticmethod
    def _dates(plan):
        cfg   = PLAN_CONFIG[plan]
        debut = timezone.now()
        return debut, debut + timedelta(days=cfg["duree_jours"])

    @staticmethod
    def _creer_modules(abonnement, plan):
        ModuleAutorise.objects.filter(abonnement=abonnement).delete()
        for m in PLAN_CONFIG[plan]["modules"]:
            ModuleAutorise.objects.create(abonnement=abonnement, nom_module=m, actif=True)

    @staticmethod
    def _ttl(abonnement):
        return max(60, int((abonnement.date_expiration - timezone.now()).total_seconds()))

    @classmethod
    @transaction.atomic
    def souscrire(cls, agence: AgenceMere, plan: str, id_transaction: str = "") -> dict:
        Abonnement.objects.filter(
            agence=agence,
            statut__in=[StatutAbonnement.ACTIVE, StatutAbonnement.TRIAL, StatutAbonnement.EXPIRING],
        ).update(statut=StatutAbonnement.RESILIATION)

        debut, expiration = cls._dates(plan)
        statut = StatutAbonnement.TRIAL if plan == PlanChoices.ESSAI else StatutAbonnement.ACTIVE

        ab = Abonnement.objects.create(
            agence=agence, id_agence=agence.agence_id,
            plan=plan, date_debut=debut, date_expiration=expiration,
            statut=statut, id_transaction_paiement=id_transaction,
        )
        cls._creer_modules(ab, plan)

        private_pem, public_pem = generate_rsa_keypair()
        SubscriptionKey.objects.create(
            abonnement=ab, cle_publique=public_pem,
            fingerprint=get_public_key_fingerprint(public_pem),
        )

        modules_list = PLAN_CONFIG[plan]["modules"]
        payload      = build_activation_payload(agence.agence_id, plan, expiration.isoformat(), modules_list)
        cle_chiffree = encrypt_activation_key(payload, public_pem)
        CleActivation.objects.create(
            abonnement=ab, cle_chiffree=cle_chiffree,
            date_expiration=expiration, nonce=payload["nonce"],
        )
        ab.cle_activation_hash = payload["hash"]
        ab.save(update_fields=["cle_activation_hash"])

        SubscriptionCacheManager.mettre_a_jour_statut(
            agence.agence_id, statut, cls._ttl(ab), modules_list, expiration.isoformat()
        )

        agence.statut_global = "ACTIVE"
        agence.save(update_fields=["statut_global"])

        HistoriqueAbonnement.ajouter_trace(ab, TypeAction.SOUSCRIPTION, f"Plan={plan}", "ADMIN")

        try:
            publier_activated(agence.agence_id, agence.nom, agence.email_officiel,
                                plan, expiration.isoformat(), cle_chiffree)
        except Exception as e:
            logger.warning(f"[MQ] {e}")

        return {"abonnement": ab, "cle_privee_pem": private_pem, "cle_chiffree": cle_chiffree}

    @classmethod
    @transaction.atomic
    def renouveler(cls, abonnement: Abonnement, plan: str, id_transaction: str = "") -> dict:
        CleActivation.objects.filter(abonnement=abonnement, revoquee=False).update(revoquee=True)

        debut, expiration = cls._dates(plan)
        abonnement.plan = plan
        abonnement.date_debut = debut
        abonnement.date_expiration = expiration
        abonnement.statut = StatutAbonnement.ACTIVE
        abonnement.id_transaction_paiement = id_transaction
        abonnement.save()

        cls._creer_modules(abonnement, plan)

        sub_key     = SubscriptionKey.objects.filter(abonnement=abonnement, actif=True).first()
        private_pem = None
        if not sub_key:
            private_pem, public_pem = generate_rsa_keypair()
            sub_key = SubscriptionKey.objects.create(
                abonnement=abonnement, cle_publique=public_pem,
                fingerprint=get_public_key_fingerprint(public_pem),
            )

        modules_list = PLAN_CONFIG[plan]["modules"]
        payload      = build_activation_payload(abonnement.id_agence, plan, expiration.isoformat(), modules_list)
        cle_chiffree = encrypt_activation_key(payload, sub_key.cle_publique)
        CleActivation.objects.create(
            abonnement=abonnement, cle_chiffree=cle_chiffree,
            date_expiration=expiration, nonce=payload["nonce"],
        )
        abonnement.cle_activation_hash = payload["hash"]
        abonnement.save(update_fields=["cle_activation_hash"])

        SubscriptionCacheManager.mettre_a_jour_statut(
            abonnement.id_agence, StatutAbonnement.ACTIVE,
            cls._ttl(abonnement), modules_list, expiration.isoformat()
        )
        HistoriqueAbonnement.ajouter_trace(abonnement, TypeAction.RENOUVELLEMENT, f"Plan={plan}", "ADMIN")

        try:
            publier_activated(abonnement.id_agence, abonnement.agence.nom,
                                abonnement.agence.email_officiel, plan, expiration.isoformat(), cle_chiffree)
        except Exception as e:
            logger.warning(f"[MQ] {e}")

        return {"abonnement": abonnement, "cle_chiffree": cle_chiffree, "cle_privee_pem": private_pem}

    @classmethod
    @transaction.atomic
    def suspendre(cls, abonnement: Abonnement, motif: str, admin_id: str) -> Abonnement:
        abonnement.statut = StatutAbonnement.SUSPENDED
        abonnement.save(update_fields=["statut"])
        abonnement.agence.statut_global = "SUSPENDED"
        abonnement.agence.save(update_fields=["statut_global"])
        SubscriptionCacheManager.bloquer_agence(abonnement.id_agence)
        HistoriqueAbonnement.ajouter_trace(abonnement, TypeAction.SUSPENSION, motif, admin_id)
        try:
            publier_suspended(abonnement.id_agence, abonnement.agence.nom,
                                abonnement.agence.email_officiel, motif, admin_id)
        except Exception as e:
            logger.warning(f"[MQ] {e}")
        return abonnement

    @classmethod
    def reactiver(cls, abonnement: Abonnement, plan: str = None, id_transaction: str = "") -> dict:
        SubscriptionCacheManager.debloquer_agence(abonnement.id_agence)
        return cls.renouveler(abonnement, plan or abonnement.plan, id_transaction)
