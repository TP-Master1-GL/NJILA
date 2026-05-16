# subscriptions/apps.py
from django.apps import AppConfig
import logging
import os
import threading

logger = logging.getLogger(__name__)


def start_rabbitmq_consumer():
    """Démarre le consommateur RabbitMQ dans un thread daemon."""
    def worker():
        from django.core.management import call_command
        call_command('consume_fleet_events')
    
    thread = threading.Thread(target=worker, daemon=True)
    thread.start()
    logger.info("[CONSUMER] Thread RabbitMQ démarré")


class SubscriptionsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'subscriptions'

    def ready(self):
        # Éviter de démarrer le consommateur pendant les migrations
        if os.environ.get('RUN_MAIN') or not os.environ.get('DJANGO_AUTORELOAD'):
            try:
                start_rabbitmq_consumer()
                logger.info("✅ Consumer RabbitMQ démarré avec succès")
            except Exception as e:
                logger.error(f"❌ Erreur démarrage consumer: {e}")
