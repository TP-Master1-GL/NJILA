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
        import sys

        # Créer ou mettre à jour le compte administrateur
        self._create_or_update_admin_user()

        # ── Démarrage du consumer RabbitMQ ─────────────────────────────────
        # • Django runserver  → RUN_MAIN == "true" dans le processus fils
        # • Gunicorn workers  → "gunicorn" est dans sys.modules
        # • manage.py migrate / collectstatic / shell → on NE démarre PAS
        is_runserver  = os.environ.get("RUN_MAIN") == "true"
        is_gunicorn   = "gunicorn" in sys.modules
        is_manage_cmd = any(cmd in sys.argv for cmd in [
            "migrate", "makemigrations", "collectstatic",
            "shell", "createsuperuser", "test",
        ])

        if (is_runserver or is_gunicorn) and not is_manage_cmd:
            self._start_consumer()
        else:
            logger.debug("[APP] Consumer RabbitMQ non démarré (commande manage.py ou processus maître)")

    def _start_consumer(self):
        """Lance le consumer RabbitMQ dans un thread daemon après un court délai."""
        def _boot():
            time.sleep(2)  # laisser Django et RabbitMQ finir leur init
            try:
                from authentication.events.consumer import EventConsumer
                consumer = EventConsumer()
                consumer.start()
                logger.info("[APP] ✅ Consumer RabbitMQ démarré")
            except Exception as e:
                logger.error("[APP] ❌ Impossible de démarrer le consumer RabbitMQ : %s", e)

        threading.Thread(target=_boot, daemon=True, name="rabbitmq-boot").start()

    def _create_or_update_admin_user(self):
        """Crée ou met à jour le compte administrateur et synchronise UNIQUEMENT si nécessaire."""
        from authentication.models import NjilaUser, Role
        from django.contrib.auth.hashers import check_password

        email          = "ronelmaamoc52@gmail.com"
        admin_password = "Ronel789"
        admin_name     = "Ronel"
        admin_surname  = "Maamoc"

        try:
            user = NjilaUser.objects.filter(email=email).first()

            if user:
                needs_update = False
                needs_sync   = False

                if user.role != Role.ADMINISTRATEUR:
                    user.role = Role.ADMINISTRATEUR
                    needs_update = needs_sync = True
                    logger.warning("[APP] ⚠ Compte %s : rôle mis à jour → ADMINISTRATEUR", email)

                if not user.is_staff:
                    user.is_staff = True
                    needs_update = needs_sync = True

                if not user.is_verified:
                    user.is_verified = True
                    needs_update = True

                if user.name != admin_name or user.surname != admin_surname:
                    user.name    = admin_name
                    user.surname = admin_surname
                    needs_update = needs_sync = True

                password_changed = False
                if not check_password(admin_password, user.password):
                    user.set_password(admin_password)
                    needs_update     = True
                    password_changed = True
                    logger.info("[APP] Mot de passe réinitialisé pour %s", email)

                if needs_update:
                    user.save()
                    logger.info("[APP] Compte administrateur mis à jour : %s", email)
                else:
                    logger.debug("[APP] Compte administrateur déjà à jour : %s", email)

                if needs_sync or password_changed:
                    self._sync_admin_with_user_service(user)
                else:
                    logger.debug("[APP] Aucune synchronisation nécessaire pour %s", email)

            else:
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
                logger.info("[APP]    Email: %s", email)
                logger.info("[APP]    Mot de passe: %s", admin_password)
                logger.info("[APP]    ID: %s", user.id)
                logger.info("=" * 60)

                self._sync_admin_with_user_service(user)

        except Exception as e:
            logger.error("[APP] Erreur création/récupération admin: %s", e, exc_info=True)

    def _sync_admin_with_user_service(self, user):
        """Synchronise le compte admin avec le user-service via RabbitMQ."""
        from authentication.events.publisher import EventPublisher

        try:
            publisher = EventPublisher()
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
                agence_id=None,
            )

            logger.info("[APP] Admin synchronisé avec user-service : %s", user.email)

        except Exception as e:
            logger.warning("[APP] Impossible de synchroniser l'admin avec user-service: %s", e)
