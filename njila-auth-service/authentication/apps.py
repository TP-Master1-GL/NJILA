from django.apps import AppConfig


class AuthenticationConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name               = "authentication"
    verbose_name       = "NJILA — Authentification"

    def ready(self):
        
        import os
        
        # Créer le compte administrateur par défaut
        self._create_or_update_admin_user()

        if os.environ.get("RUN_MAIN") == "true":
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

    def _create_or_update_admin_user(self):
        """Crée ou met à jour le compte administrateur par défaut."""
        from authentication.models import NjilaUser, Role
        import logging

        logger = logging.getLogger(__name__)
        
        email = "ronelmaamoc52@gmail.com"
        user_created = False
        
        try:
            # Chercher l'utilisateur existant
            user = NjilaUser.objects.filter(email=email).first()
            
            if user:
                # Si l'utilisateur existe mais n'est pas admin, le mettre à jour
                if user.role != Role.ADMINISTRATEUR:
                    user.role = Role.ADMINISTRATEUR
                    user.is_staff = True
                    user.is_verified = True
                    user.name = "Ronel"
                    user.surname = "Maamoc"
                    user.set_password("Ronel789")
                    user.save()
                    user_created = True
                    logger.warning(f"[APP] ⚠️ Compte {email} mis à jour : VOYAGEUR → ADMINISTRATEUR")
                    logger.info(f"[APP]    → Mot de passe: Ronel789")
                else:
                    # Vérifier que le mot de passe est correct
                    from django.contrib.auth.hashers import check_password
                    if not check_password("Ronel789", user.password):
                        user.set_password("Ronel789")
                        user.save()
                        user_created = True
                        logger.info(f"[APP] Mot de passe réinitialisé pour {email}")
                    else:
                        logger.debug(f"[APP] Compte administrateur existe déjà : {email}")
            else:
                # Créer un nouvel admin
                user = NjilaUser(
                    email       = email,
                    name        = "Ronel",
                    surname     = "Maamoc",
                    role        = Role.ADMINISTRATEUR,
                    is_active   = True,
                    is_verified = True,
                    is_staff    = True,
                    created_by  = "SYSTEM",
                )
                user.set_password("Ronel789")
                user.save()
                user_created = True
                
                logger.info("=" * 60)
                logger.info("[APP] ✅ Compte administrateur créé avec succès !")
                logger.info(f"[APP]    Email: {email}")
                logger.info(f"[APP]    Mot de passe: Ronel789")
                logger.info(f"[APP]    ID: {user.id}")
                logger.info("=" * 60)
            
            # Si le compte a été créé ou modifié, synchroniser avec user-service
            if user_created:
                self._sync_admin_with_user_service(user)
                
        except Exception as e:
            logger.error(f"[APP] ❌ Erreur création admin: {e}", exc_info=True)
    
    def _sync_admin_with_user_service(self, user):
        """Synchronise le compte admin avec le user-service via RabbitMQ."""
        from authentication.events.publisher import EventPublisher
        import logging
        
        logger = logging.getLogger(__name__)
        
        try:
            publisher = EventPublisher()
            
            # Attendre un peu que RabbitMQ soit prêt
            import time
            time.sleep(2)
            
            publisher.publish_user_registered(
                user_id=str(user.id),
                email=user.email,
                name=user.name,
                surname=user.surname,
                role=user.role,
                phone=user.phone,
                adresse=user.adresse,
                photo_url=user.photo_url,
                filiale_id=user.filiale_id,
                agence_id=user.agence_id
            )
            
            logger.info(f"[APP] ✅ Admin synchronisé avec user-service : {user.email}")
            
        except Exception as e:
            logger.warning(f"[APP] ⚠️ Impossible de synchroniser l'admin: {e}")