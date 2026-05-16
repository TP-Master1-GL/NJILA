from django.apps import AppConfig
import logging

logger = logging.getLogger(__name__)
class FleetConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'fleet'
    def ready(self):
        """
        Code exécuté au démarrage de l'application
        """
        # Éviter de démarrer le consommateur pendant les migrations
        import os
        if os.environ.get('RUN_MAIN') or not os.environ.get('DJANGO_AUTORELOAD'):
            try:
                from . import consumers
                consumers.start_consumer()
                logger.info("✅ Consumer RabbitMQ démarré")
            except Exception as e:
                logger.error(f"❌ Erreur démarrage consumer: {e}")