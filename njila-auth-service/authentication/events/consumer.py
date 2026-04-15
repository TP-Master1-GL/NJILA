import json
import logging
import threading
import time
from typing import List

from authentication.repositories.auth_repository import AuthRepository
from authentication.services.redis_cache import RedisSessionCache

logger = logging.getLogger(__name__)

# ── Exchanges ─────────────────────────────────────────────────────────────────
EXCHANGE_USER        = "njila.user.exchange"
EXCHANGE_SUBSCRIBE   = "njila.subscribe.exchange"
EXCHANGE_DEAD_LETTER = "njila.dead.letter.exchange"

# ── Queues consommées par l'auth-service ──────────────────────────────────────
QUEUE_USER_REGISTERED       = "njila.user.registered.queue"       
QUEUE_USER_UPDATED          = "njila.user.updated.queue"          
QUEUE_STAFF_TO_AUTH         = "njila.auth.staff-creation.queue"        
QUEUE_SUBSCRIPTION_EXPIRED  = "njila.auth.subscription.expired.queue"
QUEUE_SUBSCRIPTION_RENEWED  = "njila.auth.subscription.renewed.queue"


MAX_RETRIES = 5


class EventConsumer:
    """Consommateur RabbitMQ en thread daemon avec reconnexion automatique."""

    def __init__(self):
        self._thread = None
        self._should_run = True
        self._connection = None
        self._channel = None

    def start(self):
        self._thread = threading.Thread(
            target=self._run,
            daemon=True,
            name="njila-auth-rabbitmq-consumer",
        )
        self._thread.start()
        logger.info("[CONSUMER] Thread RabbitMQ démarré")

    def stop(self):
        """Arrête proprement le consumer."""
        self._should_run = False
        if self._connection and self._connection.is_open:
            self._connection.close()

    def _run(self):
        """Boucle principale avec reconnexion automatique."""
        while self._should_run:
            try:
                import pika
                from django.conf import settings

                logger.info("[CONSUMER] Tentative de connexion à RabbitMQ...")

                params = pika.ConnectionParameters(
                    host=getattr(settings, "RABBITMQ_HOST", "localhost"),
                    port=int(getattr(settings, "RABBITMQ_PORT", 5672)),
                    virtual_host=getattr(settings, "RABBITMQ_VHOST", "/"),
                    credentials=pika.PlainCredentials(
                        username=getattr(settings, "RABBITMQ_USER", "guest"),
                        password=getattr(settings, "RABBITMQ_PASS", "guest"),
                    ),
                    heartbeat=30,
                    blocked_connection_timeout=30,
                    connection_attempts=3,
                    retry_delay=2,
                )
                
                self._connection = pika.BlockingConnection(params)
                self._channel = self._connection.channel()

                # ── Déclarer tous les exchanges ───────────────────────────────────
                for exchange, ex_type in [
                    (EXCHANGE_USER,        "topic"),
                    (EXCHANGE_SUBSCRIBE,   "topic"),
                    (EXCHANGE_DEAD_LETTER, "direct"),
                ]:
                    self._channel.exchange_declare(
                        exchange=exchange,
                        exchange_type=ex_type,
                        durable=True,
                    )

                # ── Déclarer et lier les queues ───────────────────────────────────
                queues = [
                    (QUEUE_USER_REGISTERED, EXCHANGE_USER, "user.registered"),
                    (QUEUE_USER_UPDATED,    EXCHANGE_USER, "user.updated"),
                    (QUEUE_STAFF_TO_AUTH,   EXCHANGE_USER, "staff.to.auth"),
                    (QUEUE_SUBSCRIPTION_EXPIRED, EXCHANGE_SUBSCRIBE, "subscribe.expired"),
                    (QUEUE_SUBSCRIPTION_RENEWED, EXCHANGE_SUBSCRIBE, "subscribe.activated"),
                ]

                for queue_name, exchange, routing_key in queues:
                    self._channel.queue_declare(
                        queue=queue_name,
                        durable=True,
                        arguments={
                            "x-dead-letter-exchange":    EXCHANGE_DEAD_LETTER,
                            "x-dead-letter-routing-key": "dead.letter",
                            "x-message-ttl":             86400000,
                        },
                    )
                    self._channel.queue_bind(
                        queue=queue_name,
                        exchange=exchange,
                        routing_key=routing_key,
                    )
                    self._channel.basic_consume(
                        queue=queue_name,
                        on_message_callback=self._dispatch,
                        auto_ack=False,
                    )
                    logger.info(
                        "[CONSUMER] Écoute  queue=%-48s  exchange=%-28s  key=%s",
                        queue_name, exchange, routing_key,
                    )

                self._channel.basic_qos(prefetch_count=1)
                logger.info("[CONSUMER] Connecté à RabbitMQ, démarrage consommation...")
                self._channel.start_consuming()

            except Exception as e:
                logger.error("[CONSUMER] Connexion perdue: %s", e)
                if self._should_run:
                    logger.info("[CONSUMER] Reconnexion dans 5 secondes...")
                    time.sleep(5)

    def _dispatch(self, ch, method, properties, body):
        routing_key = method.routing_key
        retry_count = 0
        if properties.headers:
            deaths = properties.headers.get("x-death", [])
            if deaths:
                retry_count = deaths[0].get("count", 0)

        try:
            data = json.loads(body)
            logger.debug("[CONSUMER] Message reçu | key=%-30s retry=%d", routing_key, retry_count)

            if routing_key == "user.registered":
                self._handle_user_registered(data)
            elif routing_key == "user.updated":
                self._handle_user_updated(data)
            elif routing_key == "staff.to.auth":      
                self._handle_staff_to_auth(data)
            elif routing_key == "subscribe.expired":      # ✅ CORRIGÉ
                self._handle_subscription_expired(data)
            elif routing_key == "subscribe.activated":    # ✅ CORRIGÉ
                self._handle_subscription_renewed(data)
            else:
                logger.warning("[CONSUMER] Routing key inconnue : %s", routing_key)

            ch.basic_ack(delivery_tag=method.delivery_tag)

        except Exception as e:
            logger.error("[CONSUMER] Erreur | key=%s error=%s", routing_key, e)
            requeue = retry_count < MAX_RETRIES
            ch.basic_nack(delivery_tag=method.delivery_tag, requeue=requeue)
            if not requeue:
                logger.error("[CONSUMER] Dead letter | key=%s", routing_key)

    # ── Handlers user / staff ─────────────────────────────────────────────────

    def _handle_user_registered(self, data: dict):
        """Création d'un compte voyageur (inscription classique)."""
        role = data.get("role", "VOYAGEUR")
        if role == "VOYAGEUR":
            self._create_auth_account(data)
        else:
            logger.debug("[CONSUMER] user.registered ignoré pour rôle=%s", role)

    def _handle_user_updated(self, data: dict):
        """Invalider les tokens si l'email a changé."""
        user_id       = data.get("userId")
        email_changed = data.get("emailChanged", False)
        if not user_id or not email_changed:
            return

        repo  = AuthRepository()
        cache = RedisSessionCache()
        repo.invalidate_all(user_id)
        cache.delete_all_user_sessions(user_id)
        cache.delete_refresh_token(user_id)
        logger.info("[CONSUMER] Tokens invalidés (email changé) — user=%s", user_id)

    def _handle_staff_to_auth(self, data: dict):
        """Création d'un compte staff depuis user-service."""
        self._create_auth_account(data)

    # ── Handlers abonnement ───────────────────────────────────────────────────

    def _handle_subscription_expired(self, data: dict):
        """
        Gère l'expiration d'un abonnement.
        Routing key attendue: subscribe.expired
        """
        agence_id = data.get("agenceId")
        if not agence_id:
            logger.error("[CONSUMER] subscribe.expired : agenceId manquant")
            return

        date_expiration = data.get("dateExpiration", "?")
        plan = data.get("plan", "?")
        agence_nom = data.get("agenceNom", "?")

        repo  = AuthRepository()
        cache = RedisSessionCache()

        user_ids = repo.deactivate_agence_users(agence_id)

        if not user_ids:
            logger.info(
                "[CONSUMER] subscribe.expired | agence=%s (%s) — aucun user actif à désactiver",
                agence_id, agence_nom,
            )
            return

        repo.invalidate_sessions_by_user_ids(user_ids)

        for user_id in user_ids:
            cache.delete_all_user_sessions(user_id)
            cache.delete_refresh_token(user_id)

        logger.info(
            "[CONSUMER] subscribe.expired | agence=%s (%s) | %d users désactivés "
            "| dateExpiration=%s | plan=%s",
            agence_id, agence_nom, len(user_ids), date_expiration, plan,
        )

    def _handle_subscription_renewed(self, data: dict):
        """
        Gère l'activation ou le renouvellement d'un abonnement.
        Routing key attendue: subscribe.activated
        """
        agence_id = data.get("agenceId")
        if not agence_id:
            logger.error("[CONSUMER] subscribe.activated : agenceId manquant")
            return

        date_expiration = data.get("dateExpiration", "?")
        plan = data.get("plan", "?")
        agence_nom = data.get("agenceNom", "?")
        cle_activation = data.get("cleActivation", "?")

        repo = AuthRepository()

        user_ids = repo.reactivate_agence_users(agence_id)

        if not user_ids:
            logger.info(
                "[CONSUMER] subscribe.activated | agence=%s (%s) — aucun user à réactiver",
                agence_id, agence_nom,
            )
            return

        logger.info(
            "[CONSUMER] subscribe.activated | agence=%s (%s) | %d users réactivés "
            "| dateExpiration=%s | plan=%s | cleActivation=%s",
            agence_id, agence_nom, len(user_ids), date_expiration, plan, cle_activation,
        )

    # ── Helper création compte ────────────────────────────────────────────────

    def _create_auth_account(self, data: dict):
        """Crée un compte auth depuis un événement externe."""
        from authentication.models import NjilaUser
        from django.core.validators import validate_email
        from django.core.exceptions import ValidationError
        import uuid

        repo = AuthRepository()
        email = data.get("email", "").lower().strip()
        role = data.get("role", "GUICHETIER")
        user_id = data.get("userId")
        password = data.get("passwordTemp", "0000")
        
        name = data.get("name", "")
        surname = data.get("surname", "")
        phone = data.get("phone")
        adresse = data.get("adresse")
        photo_url = data.get("photoUrl")
        
        filiale_id = data.get("filialeId")
        agence_id = data.get("agenceId")
        
        if filiale_id == "" or filiale_id == "null" or filiale_id is None:
            filiale_id = None
        elif filiale_id:
            try:
                uuid.UUID(filiale_id)
            except ValueError:
                logger.warning("[CONSUMER] filialeId invalide: %s", filiale_id)
                filiale_id = None
        
        if agence_id == "" or agence_id == "null" or agence_id is None:
            agence_id = None
        elif agence_id:
            try:
                uuid.UUID(agence_id)
            except ValueError:
                logger.warning("[CONSUMER] agenceId invalide: %s", agence_id)
                agence_id = None
        
        poste = data.get("poste")
        numero_permis = data.get("numeroPermis")

        if not email:
            logger.error("[CONSUMER] Création compte impossible : email manquant")
            return

        try:
            validate_email(email)
        except ValidationError:
            logger.error("[CONSUMER] Email invalide : %s", email)
            return

        if repo.exists_by_email(email):
            logger.warning("[CONSUMER] Compte déjà existant pour %s — ignoré", email)
            return

        final_user_id = user_id or str(uuid.uuid4())

        meta_data = {}
        if poste:
            meta_data["poste"] = poste
        if numero_permis:
            meta_data["numeroPermis"] = numero_permis

        user = NjilaUser(
            id=final_user_id,
            email=email,
            name=name,
            surname=surname,
            phone=phone,
            adresse=adresse,
            role=role.upper(),
            photo_url=photo_url,
            filiale_id=filiale_id,  
            agence_id=agence_id,  
            is_active=True,
            is_verified=True,
            created_by="SYSTEM",
            meta_data=meta_data if meta_data else None,
        )
        user.set_password(password)
        repo.save_user(user)
        
        logger.info(
            "[CONSUMER] Compte auth créé | userId=%s email=%s role=%s filiale_id=%s agence_id=%s",
            final_user_id, email, role, filiale_id, agence_id,
        )