from django.apps import AppConfig
import logging
import time

logger = logging.getLogger(__name__)


class AuthenticationConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name               = "authentication"
    verbose_name       = "NJILA — Authentification"

    def ready(self):
        
        import os
        
        # Créer ou récupérer le compte administrateur par défaut
        self._create_or_update_admin_user()

        if os.environ.get("RUN_MAIN") == "true":
            try:
                from authentication.events.consumer import EventConsumer
                consumer = EventConsumer()
                consumer.start()
            except Exception as e:
                logger.warning("[APP] Impossible de démarrer le consommateur RabbitMQ : %s", e)

        try:
            from django.conf import settings
            from auth_config.cloud import register_to_eureka
            
            port = getattr(settings, 'SERVER_PORT', 8081)
            logger.info("[APP] Enregistrement sur Eureka avec le port %s", port)
            register_to_eureka(port)
        except Exception as e:
            logger.warning("[APP] Impossible de s'enregistrer sur Eureka : %s", e)

    def _create_or_update_admin_user(self):
        """Crée ou récupère le compte administrateur et le synchronise avec user-service."""
        from authentication.models import NjilaUser, Role
        from django.contrib.auth.hashers import check_password

        email = "ronelmaamoc52@gmail.com"
        admin_password = "Ronel789"
        admin_name = "Ronel"
        admin_surname = "Maamoc"
        
        user_created_or_updated = False
        user = None

        try:
            # Chercher l'utilisateur existant
            user = NjilaUser.objects.filter(email=email).first()
            
            if user:
                # Vérifier si l'utilisateur est déjà administrateur
                needs_update = False
                
                if user.role != Role.ADMINISTRATEUR:
                    user.role = Role.ADMINISTRATEUR
                    needs_update = True
                    logger.warning(f"[APP] ⚠ Compte {email} : VOYAGEUR → ADMINISTRATEUR")
                
                if not user.is_staff:
                    user.is_staff = True
                    needs_update = True
                
                if not user.is_verified:
                    user.is_verified = True
                    needs_update = True
                
                if user.name != admin_name or user.surname != admin_surname:
                    user.name = admin_name
                    user.surname = admin_surname
                    needs_update = True
                
                # Vérifier le mot de passe
                if not check_password(admin_password, user.password):
                    user.set_password(admin_password)
                    needs_update = True
                    logger.info(f"[APP] Mot de passe réinitialisé pour {email}")
                
                if needs_update:
                    user.save()
                    user_created_or_updated = True
                    logger.info(f"[APP] Compte administrateur mis à jour : {email}")
                else:
                    logger.debug(f"[APP] Compte administrateur existe déjà et est à jour : {email}")
            else:
                # Créer un nouvel administrateur
                user = NjilaUser(
                    email       = email,
                    name        = admin_name,
                    surname     = admin_surname,
                    role        = Role.ADMINISTRATEUR,
                    is_active   = True,
                    is_verified = True,
                    is_staff    = True,
                    created_by  = "SYSTEM",
                )
                user.set_password(admin_password)
                user.save()
                user_created_or_updated = True
                
                logger.info("=" * 60)
                logger.info("[APP] ✅ Compte administrateur créé avec succès !")
                logger.info(f"[APP]    Email: {email}")
                logger.info(f"[APP]    Mot de passe: {admin_password}")
                logger.info(f"[APP]    ID: {user.id}")
                logger.info("=" * 60)
            
            if user and user_created_or_updated:
                self._sync_admin_with_user_service(user)
            elif user:
                
                self._sync_admin_with_user_service(user)
                
        except Exception as e:
            logger.error(f"[APP]  Erreur création/récupération admin: {e}", exc_info=True)
    
    def _sync_admin_with_user_service(self, user):
        """Synchronise le compte admin avec le user-service via RabbitMQ."""
        from authentication.events.publisher import EventPublisher
        
        try:
            publisher = EventPublisher()
            
            
            time.sleep(10)
            
            publisher.publish_user_registered(
                user_id=str(user.id),
                email=user.email,
                name=user.name,
                surname=user.surname,
                role=user.role,
                phone=user.phone or "",
                adresse=user.adresse or "",
                photo_url=user.photo_url or "",
                filiale_id=None,
                agence_id=None
            )
            
            logger.info(f"[APP]  Admin synchronisé avec user-service : {user.email}")
            
        except Exception as e:
            logger.warning(f"[APP]  Impossible de synchroniser l'admin avec user-service: {e}")
