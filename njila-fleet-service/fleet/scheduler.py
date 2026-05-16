"""
Scheduler APScheduler pour auto-complete des voyages
Fichier: fleet/scheduler.py

Ce module initialise et gère les tâches planifiées (Cron jobs) pour:
- Auto-completion des voyages
- Autres tâches planifiées futures
"""

from apscheduler.schedulers.background import BackgroundScheduler
from django.core.management import call_command
from django.utils import timezone
import logging
import atexit

logger = logging.getLogger(__name__)

# Instance globale du scheduler
scheduler = BackgroundScheduler()


def start_scheduler():
    """
    Démarre le scheduler au démarrage de l'application Django
    """
    if not scheduler.running:
        # ── Ajouter la tâche d'auto-completion des voyages ────────────
        # Exécuter toutes les minutes
        scheduler.add_job(
            func=auto_complete_voyages_job,
            trigger="interval",
            minutes=1,
            id='auto_complete_voyages',
            name='Auto-complete voyages when arrival time reached',
            replace_existing=True,
            max_instances=1,  # S'assurer qu'une seule instance s'exécute
        )

        scheduler.start()
        logger.info("✓ APScheduler démarré avec succès")
        
        # Enregistrer l'arrêt du scheduler
        atexit.register(lambda: scheduler.shutdown(wait=False))


def auto_complete_voyages_job():
    """
    Fonction exécutée périodiquement pour completer les voyages
    """
    try:
        now = timezone.now()
        logger.debug(f"[APScheduler] Vérification des voyages à compléter ({now.isoformat()})")
        
        # Appeler le management command
        call_command('auto_complete_voyages')
        
    except Exception as e:
        logger.error(f"[APScheduler] Erreur lors de auto_complete_voyages: {str(e)}", exc_info=True)


def stop_scheduler():
    """
    Arrête le scheduler (appelé au shutdown)
    """
    if scheduler.running:
        scheduler.shutdown()
        logger.info("✓ APScheduler arrêté")


def get_scheduler():
    """
    Retourne l'instance du scheduler
    """
    return scheduler