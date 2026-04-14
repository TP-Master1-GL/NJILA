from django.apps import AppConfig
import logging
import threading
import time

logger = logging.getLogger(__name__)


class AuthenticationConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "authentication"
    verbose_name = "NJILA — Authentification"

    def ready(self):
        import os
        
        # Créer ou mettre à jour le compte administrateur (opération rapide)
        self._create_or_update_admin_user()

        # Démarrer le consumer SEULEMENT dans le processus principal
        if os.environ.get("RUN_MAIN") == "true":
            def start_consumer():
                # Attendre que Django soit complètement prêt
                time.sleep(2)
                try:
                    from authentication.events.consumer import EventConsumer
                    consumer = EventConsumer()
                    consumer.start()
                except Exception as e:
                    logger.warning("[APP] Impossible de démarrer le consommateur RabbitMQ : %s", e)
            
            threading.Thread(target=start_consumer, daemon=True).start()

    def _create_or_update_admin_user(self):
        """Crée ou met à jour le compte administrateur et synchronise UNIQUEMENT si nécessaire."""
        from authentication.models import NjilaUser, Role
        from django.contrib.auth.hashers import check_password

        email = "ronelmaamoc52@gmail.com"
        admin_password = "Ronel789"
        admin_name = "Ronel"
        admin_surname = "Maamoc"
        
        try:
            # Chercher l'utilisateur existant
            user = NjilaUser.objects.filter(email=email).first()
            
            if user:
                # Le compte existe déjà - Vérifier s'il faut le mettre à jour
                needs_sync = False
                needs_update = False
                
                # Vérifier le rôle
                if user.role != Role.ADMINISTRATEUR:
                    user.role = Role.ADMINISTRATEUR
                    needs_update = True
                    needs_sync = True
                    logger.warning(f"[APP] ⚠ Compte {email} : rôle mis à jour → ADMINISTRATEUR")
                
                # Vérifier les permissions staff
                if not user.is_staff:
                    user.is_staff = True
                    needs_update = True
                    needs_sync = True
                
                # Vérifier la vérification
                if not user.is_verified:
                    user.is_verified = True
                    needs_update = True
                
                # Vérifier le nom
                if user.name != admin_name or user.surname != admin_surname:
                    user.name = admin_name
                    user.surname = admin_surname
                    needs_update = True
                    needs_sync = True
                
                # Vérifier le mot de passe
                password_changed = False
                if not check_password(admin_password, user.password):
                    user.set_password(admin_password)
                    needs_update = True
                    password_changed = True
                    logger.info(f"[APP] Mot de passe réinitialisé pour {email}")
                
                if needs_update:
                    user.save()
                    logger.info(f"[APP] Compte administrateur mis à jour : {email}")
                else:
                    logger.debug(f"[APP] Compte administrateur déjà à jour : {email}")
                
                # Synchroniser avec user-service SEULEMENT si des données importantes ont changé
                if needs_sync or password_changed:
                    self._sync_admin_with_user_service(user)
                else:
                    logger.debug(f"[APP] Aucune synchronisation nécessaire pour {email}")
                    
            else:
                # Créer un nouvel administrateur
                user = NjilaUser(
                    email=email,
                    name=admin_name,
                    surname=admin_surname,
                    role=Role.ADMINISTRATEUR,
                    is_active=True,
                    is_verified=True,
                    is_staff=True,
                    created_by="SYSTEM",
                )
                user.set_password(admin_password)
                user.save()
                
                logger.info("=" * 60)
                logger.info("[APP] ✅ Compte administrateur créé avec succès !")
                logger.info(f"[APP]    Email: {email}")
                logger.info(f"[APP]    Mot de passe: {admin_password}")
                logger.info(f"[APP]    ID: {user.id}")
                logger.info("=" * 60)
                
                # Synchroniser avec user-service (nécessaire pour nouveau compte)
                self._sync_admin_with_user_service(user)
                
        except Exception as e:
            logger.error(f"[APP] Erreur création/récupération admin: {e}", exc_info=True)
    
    def _sync_admin_with_user_service(self, user):
        """Synchronise le compte admin avec le user-service via RabbitMQ UNIQUEMENT si nécessaire."""
        from authentication.events.publisher import EventPublisher
        
        try:
            publisher = EventPublisher()
            
            # Attendre un peu que RabbitMQ soit prêt (seulement si nécessaire)
            time.sleep(0.5)
            
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
            
            logger.info(f"[APP] Admin synchronisé avec user-service : {user.email}")
            
        except Exception as e:
            logger.warning(f"[APP] Impossible de synchroniser l'admin avec user-service: {e}")