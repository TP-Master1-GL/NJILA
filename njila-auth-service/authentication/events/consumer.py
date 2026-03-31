"""
EventConsumer — consommateur RabbitMQ de l'auth-service.

Exchanges et queues écoutés :
  ┌───────────────────────────────────────────────────────────────────────────┐
  │  Queue                              Exchange source    Routing key         │
  ├───────────────────────────────────────────────────────────────────────────┤
  │  njila.auth.user.registered.queue   njila.user.exchange   user.registered  │
  │  njila.auth.user.updated.queue      njila.user.exchange   user.updated     │
  │  njila.auth.staff.created.queue     njila.user.exchange   staff.created    │
  ├───────────────────────────────────────────────────────────────────────────┤
  │  njila.auth.subscription.expired.queue                                     │
  │                            njila.subscribe.exchange  subscription.expired  │
  │  njila.auth.subscription.renewed.queue                                     │
  │                            njila.subscribe.exchange  subscription.renewed  │
  └───────────────────────────────────────────────────────────────────────────┘

Événements d'abonnement :
  subscription.expired  payload: { agenceId, expiresAt, message? }
    → désactiver tous les users staff de l'agence (bulk)
    → révoquer leurs sessions Redis + invalider en DB

  subscription.renewed  payload: { agenceId, newExpiresAt }
    → réactiver tous les users staff de l'agence (bulk, sauf ADMIN_SUSPENDED)
"""

import json
import logging
import threading
from typing import List

# Imports au niveau du module pour permettre le patch dans les tests unitaires.
# @patch("authentication.events.consumer.RedisSessionCache") requiert que
# RedisSessionCache soit un attribut du module consumer, pas un import local.
from authentication.repositories.auth_repository import AuthRepository
from authentication.services.redis_cache import RedisSessionCache

logger = logging.getLogger(__name__)

# ── Exchanges ─────────────────────────────────────────────────────────────────
EXCHANGE_USER        = "njila.user.exchange"
EXCHANGE_SUBSCRIBE   = "njila.subscribe.exchange"
EXCHANGE_DEAD_LETTER = "njila.dead.letter.exchange"

# ── Queues consommées par l'auth-service ──────────────────────────────────────
QUEUE_USER_REGISTERED       = "njila.auth.user.registered.queue"
QUEUE_USER_UPDATED          = "njila.auth.user.updated.queue"
QUEUE_STAFF_CREATED         = "njila.auth.staff.created.queue"
QUEUE_SUBSCRIPTION_EXPIRED  = "njila.auth.subscription.expired.queue"
QUEUE_SUBSCRIPTION_RENEWED  = "njila.auth.subscription.renewed.queue"

MAX_RETRIES = 3


class EventConsumer:
    """Consommateur RabbitMQ en thread daemon."""

    def __init__(self):
        self._thread = None

    def start(self):
        self._thread = threading.Thread(
            target = self._run,
            daemon = True,
            name   = "njila-auth-rabbitmq-consumer",
        )
        self._thread.start()
        logger.info("[CONSUMER] Thread RabbitMQ démarré")

    def _run(self):
        try:
            import pika
            from django.conf import settings

            params = pika.ConnectionParameters(
                host                       = getattr(settings, "RABBITMQ_HOST",  "localhost"),
                port                       = int(getattr(settings, "RABBITMQ_PORT", 5672)),
                virtual_host               = getattr(settings, "RABBITMQ_VHOST", "/"),
                credentials                = pika.PlainCredentials(
                    username = getattr(settings, "RABBITMQ_USER", "guest"),
                    password = getattr(settings, "RABBITMQ_PASS", "guest"),
                ),
                heartbeat                  = 600,
                blocked_connection_timeout = 300,
            )
            connection = pika.BlockingConnection(params)
            channel    = connection.channel()

            # ── Déclarer tous les exchanges ───────────────────────────────────
            for exchange, ex_type in [
                (EXCHANGE_USER,        "topic"),
                (EXCHANGE_SUBSCRIBE,   "topic"),
                (EXCHANGE_DEAD_LETTER, "direct"),
            ]:
                channel.exchange_declare(
                    exchange      = exchange,
                    exchange_type = ex_type,
                    durable       = True,
                )

            # ── Déclarer et lier les queues ───────────────────────────────────
            queues = [
                # Messages du user-service / fleet-service → auth
                (QUEUE_USER_REGISTERED,      EXCHANGE_USER,      "user.registered"),
                (QUEUE_USER_UPDATED,         EXCHANGE_USER,      "user.updated"),
                (QUEUE_STAFF_CREATED,        EXCHANGE_USER,      "staff.created"),
                # Messages du subscribe-service → auth
                (QUEUE_SUBSCRIPTION_EXPIRED, EXCHANGE_SUBSCRIBE, "subscription.expired"),
                (QUEUE_SUBSCRIPTION_RENEWED, EXCHANGE_SUBSCRIBE, "subscription.renewed"),
            ]

            for queue_name, exchange, routing_key in queues:
                channel.queue_declare(
                    queue     = queue_name,
                    durable   = True,
                    arguments = {
                        "x-dead-letter-exchange":    EXCHANGE_DEAD_LETTER,
                        "x-dead-letter-routing-key": "dead.letter",
                        "x-message-ttl":             86400000,
                    },
                )
                channel.queue_bind(
                    queue       = queue_name,
                    exchange    = exchange,
                    routing_key = routing_key,
                )
                channel.basic_consume(
                    queue               = queue_name,
                    on_message_callback = self._dispatch,
                    auto_ack            = False,
                )
                logger.info(
                    "[CONSUMER] Écoute  queue=%-48s  exchange=%-28s  key=%s",
                    queue_name, exchange, routing_key,
                )

            channel.basic_qos(prefetch_count=1)
            channel.start_consuming()

        except Exception as e:
            logger.error("[CONSUMER] Erreur connexion RabbitMQ : %s", e)

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
            elif routing_key == "staff.created":
                self._handle_staff_created(data)
            elif routing_key == "subscription.expired":
                self._handle_subscription_expired(data)
            elif routing_key == "subscription.renewed":
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
        role = data.get("role", "VOYAGEUR")
        if role == "VOYAGEUR":
            return
        self._create_auth_account(data)

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

    def _handle_staff_created(self, data: dict):
        self._create_auth_account(data)

    # ── Handlers abonnement ───────────────────────────────────────────────────

    def _handle_subscription_expired(self, data: dict):
        """
        subscription.expired — payload : { agenceId, expiresAt, message? }

        Actions :
          1. Désactiver en bulk tous les users staff de l'agence (reason: SUBSCRIPTION_EXPIRED)
          2. Invalider leurs sessions en DB
          3. Supprimer leurs sessions Redis (blacklist implicite via is_active=False)
          4. Log de traçabilité
        """
        agence_id = data.get("agenceId")
        if not agence_id:
            logger.error("[CONSUMER] subscription.expired : agenceId manquant")
            return

        expires_at = data.get("expiresAt", "?")
        message    = data.get("message", "Abonnement expiré")

        repo  = AuthRepository()
        cache = RedisSessionCache()

        # ① Désactiver les users en base (bulk UPDATE)
        user_ids = repo.deactivate_agence_users(agence_id)

        if not user_ids:
            logger.info(
                "[CONSUMER] subscription.expired | agence=%s — aucun user actif à désactiver",
                agence_id,
            )
            return

        # ② Invalider les sessions en DB
        repo.invalidate_sessions_by_user_ids(user_ids)

        # ③ Supprimer les sessions Redis pour chaque utilisateur
        for user_id in user_ids:
            cache.delete_all_user_sessions(user_id)
            cache.delete_refresh_token(user_id)

        logger.info(
            "[CONSUMER] subscription.expired | agence=%s | %d users désactivés "
            "| expiresAt=%s | %s",
            agence_id, len(user_ids), expires_at, message,
        )

    def _handle_subscription_renewed(self, data: dict):
        """
        subscription.renewed — payload : { agenceId, newExpiresAt }

        Actions :
          1. Réactiver en bulk tous les users staff de l'agence
             (uniquement ceux désactivés pour SUBSCRIPTION_EXPIRED)
          2. Log de traçabilité
          Note : les sessions ne sont PAS recréées automatiquement.
                 Les utilisateurs doivent se reconnecter (ce qui est normal
                 après un renouvellement d'abonnement).
        """
        agence_id    = data.get("agenceId")
        new_expires  = data.get("newExpiresAt", "?")

        if not agence_id:
            logger.error("[CONSUMER] subscription.renewed : agenceId manquant")
            return

        repo = AuthRepository()

        # Réactiver en base (bulk UPDATE)
        user_ids = repo.reactivate_agence_users(agence_id)

        if not user_ids:
            logger.info(
                "[CONSUMER] subscription.renewed | agence=%s — aucun user à réactiver",
                agence_id,
            )
            return

        logger.info(
            "[CONSUMER] subscription.renewed | agence=%s | %d users réactivés "
            "| newExpiresAt=%s",
            agence_id, len(user_ids), new_expires,
        )

    # ── Helper création compte ────────────────────────────────────────────────

    def _create_auth_account(self, data: dict):
        """
        Crée un compte auth depuis un événement externe.
        Payload : { userId, email, role, passwordTemp, name, surname, phone, adresse, photoUrl, filialeId, agenceId }
        """
        from authentication.models import NjilaUser

        repo       = AuthRepository()
        email      = data.get("email", "").lower().strip()
        role       = data.get("role", "GUICHETIER")
        user_id    = data.get("userId")
        password   = data.get("passwordTemp", "NjilaChange2026!")
        # Données d'identité — alignées avec UserProfile (user-service)
        name       = data.get("name",    "")   # prénom
        surname    = data.get("surname", "")   # nom de famille
        phone      = data.get("phone")
        adresse    = data.get("adresse")
        photo_url  = data.get("photoUrl")
        filiale_id = data.get("filialeId")
        agence_id  = data.get("agenceId")

        if not email:
            logger.error("[CONSUMER] Création compte impossible : email manquant")
            return

        if repo.exists_by_email(email):
            logger.warning("[CONSUMER] Compte déjà existant pour %s — ignoré", email)
            return

        user = NjilaUser(
            id          = user_id or None,
            email       = email,
            name        = name,
            surname     = surname,
            phone       = phone,
            adresse     = adresse,
            role        = role,
            photo_url   = photo_url,
            filiale_id  = filiale_id,
            agence_id   = agence_id,
            is_active   = True,    # agence créée = abonnement valide
            is_verified = True,
            created_by  = "SYSTEM",
        )
        user.set_password(password)
        repo.save_user(user)
        logger.info("[CONSUMER] Compte auth créé | email=%s role=%s", email, role)