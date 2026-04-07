from django.apps import AppConfig


class AuthenticationConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name               = "authentication"
    verbose_name       = "NJILA — Authentification"

    def ready(self):
        
        import os
        if os.environ.get("RUN_MAIN") != "true":
            return

        # Créer le compte administrateur par défaut
        self._create_admin_user()

        try:
            from authentication.events.consumer import EventConsumer
            consumer = EventConsumer()
            consumer.start()
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

    def _create_admin_user(self):
        """Crée un compte administrateur par défaut s'il n'existe pas."""
        from authentication.models import NjilaUser, Role
        import logging

        logger = logging.getLogger(__name__)
        
        email = "ronalmaamoc52@gmail.com"
        
        # Vérifier si l'admin existe déjà
        if not NjilaUser.objects.filter(email=email).exists():
            try:
                admin_user = NjilaUser(
                    email       = email,
                    name        = "Ronel",
                    surname     = "Maamoc",
                    role        = Role.ADMINISTRATEUR,
                    is_active   = True,
                    is_verified = True,
                    is_staff    = True,
                    created_by  = "SYSTEM",
                )
                admin_user.set_password("Ronel789")
                admin_user.save()
                
                logger.info("[APP] Compte administrateur créé avec succès : %s", email)
                logger.info("[APP]   → Mot de passe : Ronel789")
                logger.info("[APP]   → ID: %s", admin_user.id)
            except Exception as e:
                logger.error("[APP] Erreur lors de la création du compte admin : %s", e)
        else:
            logger.debug("[APP] Compte administrateur existe déjà : %s", email)
