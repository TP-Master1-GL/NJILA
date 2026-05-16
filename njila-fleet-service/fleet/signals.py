"""
Signaux Django pour les événements métier
Fichier: fleet/signals.py

Les signaux permettent de déclencher des actions automatiquement
lors de certains événements sur les modèles
"""

from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
from django.utils import timezone
from django.db import transaction
from fleet.models import Voyage, StatusVoyage, StatusBus
from fleet.rabbitmq import publish_voyage_updated_for_booking, publish_bus_updated_for_booking
import logging

logger = logging.getLogger(__name__)


@receiver(pre_save, sender=Voyage)
def on_voyage_pre_save(sender, instance, **kwargs):
    """
    Appelé AVANT la sauvegarde d'un voyage
    Utilisé pour les validations et transformations
    """
    try:
        # Si le voyage est en cours et l'heure d'arrivée est proche
        if instance.status == StatusVoyage.EN_COURS:
            now = timezone.now()
            if instance.date_heure_arrive_prevue and instance.date_heure_arrive_prevue <= now:
                # Auto-marquer comme terminé
                logger.warning(
                    f"Voyage {instance.Id_voyage}: heure d'arrivée dépassée, "
                    f"sera marqué comme TERMINE"
                )

    except Exception as e:
        logger.error(f"Erreur dans on_voyage_pre_save: {str(e)}")


@receiver(post_save, sender=Voyage)
def on_voyage_post_save(sender, instance, created, **kwargs):
    """
    Appelé APRÈS la sauvegarde d'un voyage
    Utilisé pour les actions post-save (notifications, mises à jour en cascade, etc.)
    """
    try:
        if created:
            logger.info(f"Nouveau voyage créé: {instance.Id_voyage}")

        # Log pour le suivi
        logger.debug(f"Voyage {instance.Id_voyage} sauvegardé avec le statut: {instance.status}")

    except Exception as e:
        logger.error(f"Erreur dans on_voyage_post_save: {str(e)}")


@receiver(post_save, sender=Voyage)
def on_voyage_status_changed(sender, instance, created, update_fields, **kwargs):
    """
    Déclenche des actions quand le statut d'un voyage change
    """
    try:
        # Si c'est une mise à jour et le statut a changé
        if not created and update_fields and 'status' in update_fields:
            if instance.status == StatusVoyage.TERMINE:
                logger.info(
                    f"Signal: Voyage {instance.Id_voyage} marqué comme TERMINE, "
                    f"libération des ressources..."
                )
                # Les ressources sont déjà libérées par le scheduler ou la vue
                # Ce signal est juste pour le log/monitoring

    except Exception as e:
        logger.error(f"Erreur dans on_voyage_status_changed: {str(e)}")