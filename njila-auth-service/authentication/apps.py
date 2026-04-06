from django.apps import AppConfig


class AuthenticationConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name               = "authentication"
    verbose_name       = "NJILA — Authentification"

    def ready(self):
        
        import os
        if os.environ.get("RUN_MAIN") != "true":
            return

        # ─── 1. Démarrer le consommateur RabbitMQ ────────────────────────────────
        try:
            from authentication.events.consumer import EventConsumer
            consumer = EventConsumer()
            consumer.start()
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(
                "[APP] Impossible de démarrer le consommateur RabbitMQ : %s", e
            )

        # ─── 2. Enregistrement sur Eureka ─────────────────────────────────────────
        try:
            from django.conf import settings
            from auth_config.cloud import register_to_eureka
            
            port = getattr(settings, 'SERVER_PORT', 8081)
            import logging
            logging.getLogger(__name__).info(
                "[APP] Enregistrement sur Eureka avec le port %s", port
            )
            register_to_eureka(port)
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(
                "[APP] Impossible de s'enregistrer sur Eureka : %s", e
            )