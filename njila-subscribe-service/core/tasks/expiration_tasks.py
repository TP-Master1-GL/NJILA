"""
Tâche Celery planifiée — vérification quotidienne des expirations.
Lancée chaque nuit à 23:00 UTC (= minuit heure de Douala).
"""
import logging
from datetime import date, timedelta

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(name="verifier_expirations_quotidiennes")
def verifier_expirations_quotidiennes():
    from subscriptions.models import Abonnement, StatutAbonnement
    from core.cache.subscription_cache_manager import SubscriptionCacheManager
    from core.tasks.rabbitmq_publisher import publier_expired, publier_expiry_warning

    aujourd_hui = date.today()

    # ── J-0 : expirer les abonnements arrivés à échéance ──────────────────────
    expires = Abonnement.objects.filter(
        statut__in=[StatutAbonnement.ACTIVE, StatutAbonnement.TRIAL, StatutAbonnement.EXPIRING],
        date_expiration__date=aujourd_hui,
    ).select_related("agence")

    for ab in expires:
        ab.statut = StatutAbonnement.EXPIRED
        ab.save(update_fields=["statut"])
        SubscriptionCacheManager.invalider_cache(ab.id_agence)
        SubscriptionCacheManager.mettre_a_jour_statut(ab.id_agence, "EXPIRED", 86400)
        publier_expired(ab.id_agence, ab.agence.nom, ab.agence.email_officiel,
                        ab.plan, ab.date_expiration.isoformat())
        logger.info(f"[EXPIRATION] Abonnement expiré : {ab.id_agence}")

    # ── Alertes J-1, J-7, J-30 ────────────────────────────────────────────────
    for jours in [1, 7, 30]:
        cible = aujourd_hui + timedelta(days=jours)
        for ab in Abonnement.objects.filter(
            statut__in=[StatutAbonnement.ACTIVE, StatutAbonnement.TRIAL],
            date_expiration__date=cible,
        ).select_related("agence"):
            publier_expiry_warning(
                ab.id_agence, ab.agence.nom, ab.agence.email_officiel,
                ab.plan, ab.date_expiration.isoformat(), jours,
            )
            logger.info(f"[ALERTE] J-{jours} : {ab.id_agence}")