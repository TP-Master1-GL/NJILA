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
    from subscriptions.models import Abonnement, StatutAbonnement, TypeAction, HistoriqueAbonnement
    from core.cache.subscription_cache_manager import SubscriptionCacheManager
    from core.tasks.rabbitmq_publisher import publier_expired, publier_expiry_warning

    aujourd_hui = date.today()

    # ── J-0 : expirer les abonnements arrivés à échéance ──────────────────────
    expires = Abonnement.objects.filter(
        statut__in=[StatutAbonnement.ACTIVE, StatutAbonnement.TRIAL, StatutAbonnement.EXPIRING],
        date_expiration__date=aujourd_hui,
    ).select_related("agence")

    for ab in expires:
        # 1. Mettre à jour le statut abonnement
        ab.statut = StatutAbonnement.EXPIRED
        ab.save(update_fields=["statut"])

        # 2. Mettre à jour le statut global de l'AgenceMere
        ab.agence.statut_global = "EXPIRED"
        ab.agence.save(update_fields=["statut_global"])

        # 3. Tracer dans l'historique
        HistoriqueAbonnement.ajouter_trace(
            ab, TypeAction.EXPIRATION,
            details=f"Expiration automatique du plan {ab.plan}",
            operateur="SYSTEM",
        )

        # 4. Cache : invalider + marquer EXPIRED (TTL 24h)
        SubscriptionCacheManager.invalider_cache(ab.id_agence)
        SubscriptionCacheManager.mettre_a_jour_statut(ab.id_agence, "EXPIRED", 86400)

        # 5. Publier sur RabbitMQ → notification-service + auth-service
        try:
            publier_expired(
                agence_id=ab.id_agence,           # AgenceMere.agence_id
                nom=ab.agence.nom,                # AgenceMere.nom
                email=ab.agence.email_officiel,   # AgenceMere.email_officiel
                plan=ab.plan,                     # Abonnement.plan
                date_exp=ab.date_expiration.isoformat(),
            )
        except Exception as e:
            logger.error(f"[MQ] Erreur publier_expired {ab.id_agence} : {e}")

        logger.info(f"[EXPIRATION] Abonnement expiré : {ab.id_agence}")

    # ── Alertes J-1, J-7, J-30 ────────────────────────────────────────────────
    for jours in [1, 7, 30]:
        cible = aujourd_hui + timedelta(days=jours)
        avertis = Abonnement.objects.filter(
            statut__in=[StatutAbonnement.ACTIVE, StatutAbonnement.TRIAL],
            date_expiration__date=cible,
        ).select_related("agence")

        for ab in avertis:
            try:
                publier_expiry_warning(
                    agence_id=ab.id_agence,
                    nom=ab.agence.nom,
                    email=ab.agence.email_officiel,
                    plan=ab.plan,
                    date_exp=ab.date_expiration.isoformat(),
                    jours_restants=jours,
                )
            except Exception as e:
                logger.error(f"[MQ] Erreur publier_expiry_warning {ab.id_agence} J-{jours} : {e}")

            logger.info(f"[ALERTE] J-{jours} : {ab.id_agence}")