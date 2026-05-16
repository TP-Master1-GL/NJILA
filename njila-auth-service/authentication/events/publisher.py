import json
import logging
import threading
import time
from typing import Optional

logger = logging.getLogger(__name__)

# ── Exchanges ─────────────────────────────────────────────────────────────────
EXCHANGE_USER         = "njila.user.exchange"
EXCHANGE_NOTIFICATION = "njila.notification.exchange"
EXCHANGE_SUBSCRIBE    = "njila.subscribe.exchange"
EXCHANGE_DEAD_LETTER  = "njila.dead.letter.exchange"

# ── Routing keys ──────────────────────────────────────────────────────────────
ROUTING_USER_REGISTERED = "user.registered"
ROUTING_USER_UPDATED    = "user.updated"
ROUTING_PASSWORD_RESET  = "auth.password.reset"
ROUTING_WELCOME_EMAIL   = "auth.user.welcome"


class EventPublisher:

    def __init__(self):
        self._lock = threading.Lock()
        self._connection = None
        self._channel = None
        self._connected = False
        self._try_connect()

    # ─── Connexion ────────────────────────────────────────────────────────────

    def _try_connect(self):
        """Tente de se connecter à RabbitMQ. Jamais appelé sous _lock."""
        try:
            import pika
            from django.conf import settings

            params = pika.ConnectionParameters(
                host=getattr(settings, "RABBITMQ_HOST", "localhost"),
                port=int(getattr(settings, "RABBITMQ_PORT", 5672)),
                virtual_host=getattr(settings, "RABBITMQ_VHOST", "/"),
                credentials=pika.PlainCredentials(
                    username=getattr(settings, "RABBITMQ_USER", "guest"),
                    password=getattr(settings, "RABBITMQ_PASS", "guest"),
                ),
                heartbeat=30,
                blocked_connection_timeout=10,
                connection_attempts=2,
                retry_delay=1,
                socket_timeout=5,
            )
            self._connection = pika.BlockingConnection(params)
            self._channel = self._connection.channel()

            for exchange, ex_type in [
                (EXCHANGE_USER,         "topic"),
                (EXCHANGE_NOTIFICATION, "topic"),
                (EXCHANGE_SUBSCRIBE,    "topic"),
                (EXCHANGE_DEAD_LETTER,  "direct"),
            ]:
                self._channel.exchange_declare(
                    exchange=exchange,
                    exchange_type=ex_type,
                    durable=True,
                )

            self._connected = True
            logger.info(
                "[RABBITMQ] Connexion établie — exchanges: %s | %s | %s",
                EXCHANGE_USER, EXCHANGE_NOTIFICATION, EXCHANGE_SUBSCRIBE,
            )

        except Exception as e:
            self._connected = False
            logger.warning("[RABBITMQ] Indisponible : %s", e)

    # ─── Publication d'un lot de messages (dans un seul thread) ──────────────

    def _publish_batch_sync(self, messages: list):
        """
        Publie une liste de messages {exchange, routing_key, payload} dans
        un seul thread avec une seule connexion partagée.
        En cas de déconnexion, tente UNE reconnexion puis réessaie le message
        échoué avant de continuer — aucun message n'est silencieusement perdu.
        """
        with self._lock:
            for msg in messages:
                exchange    = msg["exchange"]
                routing_key = msg["routing_key"]
                payload     = msg["payload"]
                self._publish_once(exchange, routing_key, payload)

    def _publish_once(self, exchange: str, routing_key: str, payload: dict, _retried: bool = False):
        """
        Publie un seul message. Si la connexion est morte, tente une reconnexion
        et réessaie une fois. Doit être appelé sous _lock.
        """
        # Reconnexion si nécessaire
        if not self._connected or not self._connection or not self._connection.is_open:
            logger.warning("[RABBITMQ] Connexion perdue, reconnexion...")
            self._try_connect()

        if not self._connected:
            logger.error(
                "[RABBITMQ] Message perdu (indisponible) | exchange=%s key=%s",
                exchange, routing_key,
            )
            return

        try:
            import pika
            self._channel.basic_publish(
                exchange=exchange,
                routing_key=routing_key,
                body=json.dumps(payload),
                properties=pika.BasicProperties(
                    delivery_mode=2,
                    content_type="application/json",
                ),
            )
            logger.debug("[RABBITMQ] Publié | exchange=%s key=%s", exchange, routing_key)

        except Exception as e:
            logger.error("[RABBITMQ] Erreur publication : %s", e)
            self._connected = False

            if not _retried:
                # ✅ Une seule tentative de retry — évite la récursion infinie
                logger.warning("[RABBITMQ] Retry unique pour key=%s", routing_key)
                self._publish_once(exchange, routing_key, payload, _retried=True)
            else:
                logger.error(
                    "[RABBITMQ] Message définitivement perdu après retry | exchange=%s key=%s",
                    exchange, routing_key,
                )

    # ─── API publique — fire and forget en batch ──────────────────────────────

    def publish(self, exchange: str, routing_key: str, payload: dict):
        """
        Publie un message isolé dans un thread daemon.
        Préférer publish_batch pour les publications groupées.
        """
        self.publish_batch([{"exchange": exchange, "routing_key": routing_key, "payload": payload}])

    def publish_batch(self, messages: list):
        """
        Lance la publication de plusieurs messages dans UN SEUL thread daemon.
        Garantit l'ordre et partage la connexion — aucun message ne tombe
        dans la fissure d'une reconnexion comme avec 3 threads indépendants.
        """
        t = threading.Thread(
            target=self._publish_batch_sync,
            args=(messages,),
            daemon=True,
            name=f"rabbitmq-batch-{messages[0]['routing_key'] if messages else 'empty'}",
        )
        t.start()

    # ─── Méthodes métier ──────────────────────────────────────────────────────

    def publish_user_registered(
        self,
        user_id: str,
        email: str,
        name: str,
        surname: str,
        role: str,
        phone: Optional[str] = None,
        adresse: Optional[str] = None,
        photo_url: Optional[str] = None,
        filiale_id: Optional[str] = None,
        agence_id: Optional[str] = None,
    ):
        # ✅ Les 3 publications dans UN SEUL thread — plus de message perdu
        # lors d'une reconnexion entre deux threads indépendants.
        self.publish_batch([
            # 1. Pour njila-user-service
            {
                "exchange":    EXCHANGE_USER,
                "routing_key": "user.registered",
                "payload": {
                    "userId":    user_id,
                    "email":     email,
                    "name":      name,
                    "surname":   surname,
                    "role":      role,
                    "phone":     phone,
                    "adresse":   adresse,
                    "photoUrl":  photo_url,
                    "filialeId": filiale_id,
                    "agenceId":  agence_id,
                },
            },
            # 2. Pour njila-booking-service
            {
                "exchange":    EXCHANGE_USER,
                "routing_key": "user.registered.booking",
                "payload": {
                    "type": "user.registered",
                    "data": {
                        "userId":              user_id,
                        "id":                  user_id,
                        "name":                name,
                        "nom":                 name,
                        "surname":             surname,
                        "prenom":              surname,
                        "email":               email,
                        "phone":               phone,
                        "telephone":           phone,
                        "adresse":             adresse,
                        "address":             adresse,
                        "photo_portrait_url":  photo_url,
                        "role":                role,
                        "agence_id":           agence_id,
                        "filiale_id":          filiale_id,
                    },
                },
            },
            # 3. Pour njila-notification-service
            {
                "exchange":    EXCHANGE_NOTIFICATION,
                "routing_key": ROUTING_WELCOME_EMAIL,
                "payload": {
                    "email":   email,
                    "name":    name,
                    "surname": surname,
                    "type":    "welcome",
                },
            },
        ])

        logger.info("[RABBITMQ] user.registered publié (async batch) | userId=%s", user_id)

    def publish_user_updated(
        self,
        user_id: str,
        email: str,
        email_changed: bool = False,
        photo_url: Optional[str] = None,
        name: Optional[str] = None,
        surname: Optional[str] = None,
        phone: Optional[str] = None,
        adresse: Optional[str] = None,
        role: Optional[str] = None,
        filiale_id: Optional[str] = None,
        agence_id: Optional[str] = None,
    ):
        # ✅ Les 2 publications dans UN SEUL thread
        self.publish_batch([
            # 1. Pour njila-user-service
            {
                "exchange":    EXCHANGE_USER,
                "routing_key": "user.updated",
                "payload": {
                    "userId":       user_id,
                    "email":        email,
                    "emailChanged": email_changed,
                    "photoUrl":     photo_url,
                    "name":         name,
                    "surname":      surname,
                    "phone":        phone,
                    "adresse":      adresse,
                    "role":         role,
                    "filialeId":    filiale_id,
                    "agenceId":     agence_id,
                },
            },
            # 2. Pour njila-booking-service
            {
                "exchange":    EXCHANGE_USER,
                "routing_key": "user.updated.booking",
                "payload": {
                    "type": "user.updated",
                    "data": {
                        "userId":             user_id,
                        "id":                 user_id,
                        "email":              email,
                        "photoUrl":           photo_url,
                        "photo_portrait_url": photo_url,
                        "name":               name,
                        "nom":                name,
                        "surname":            surname,
                        "prenom":             surname,
                        "phone":              phone,
                        "telephone":          phone,
                        "adresse":            adresse,
                        "address":            adresse,
                        "role":               role,
                        "agence_id":          agence_id,
                        "filiale_id":         filiale_id,
                    },
                },
            },
        ])

        logger.info(
            "[RABBITMQ] user.updated publié (async batch) | userId=%s emailChanged=%s",
            user_id, email_changed,
        )

    def publish_password_reset(self, email: str, reset_link: str, name: str = ""):
        self.publish(
            exchange=EXCHANGE_NOTIFICATION,
            routing_key=ROUTING_PASSWORD_RESET,
            payload={
                "email":     email,
                "name":      name,
                "resetLink": reset_link,
                "type":      "password_reset",
            },
        )
