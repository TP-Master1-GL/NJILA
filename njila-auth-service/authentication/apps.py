from django.apps import AppConfig
import threading
import time


class AuthenticationConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name               = "authentication"
    verbose_name       = "NJILA — Authentification"

    def ready(self):
        
        import os

        if os.environ.get("RUN_MAIN") == "true":
            try:
                from authentication.events.consumer import EventConsumer
                consumer = EventConsumer()
                consumer.start()
                
                # Démarrer un thread pour appeler l'endpoint sync-admin après le démarrage
                self._call_sync_admin_endpoint()
                
            except Exception as e:
                import logging
                logging.getLogger(__name__).warning(
                    "[APP] Impossible de démarrer le consommateur RabbitMQ : %s", e
                )

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

    def _call_sync_admin_endpoint(self):
        """Appelle l'endpoint sync-admin après le démarrage du serveur."""
        def call_endpoint():
            # Attendre que le serveur HTTP soit complètement démarré
            time.sleep(10)
            
            try:
                import requests
                response = requests.post(
                    "http://localhost:8081/api/auth/sync-admin",
                    timeout=5
                )
                
                import logging
                logger = logging.getLogger(__name__)
                
                if response.status_code == 200:
                    logger.info("[APP] ✅ Admin synchronisé avec user-service au démarrage")
                    logger.debug(f"[APP] Réponse: {response.json()}")
                else:
                    logger.warning(f"[APP] ⚠️ Synchronisation admin échouée: {response.status_code}")
                    
            except requests.exceptions.ConnectionError:
                import logging
                logging.getLogger(__name__).warning(
                    "[APP] Impossible d'appeler sync-admin - Serveur non prêt"
                )
            except Exception as e:
                import logging
                logging.getLogger(__name__).warning(
                    f"[APP] Erreur lors de l'appel à sync-admin: {e}"
                )
        
        thread = threading.Thread(target=call_endpoint, daemon=True)
        thread.start()
