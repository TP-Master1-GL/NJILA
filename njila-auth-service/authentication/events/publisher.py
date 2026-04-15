import json
import logging
import threading
import time
from typing import Optional

logger = logging.getLogger(__name__)

# ── Exchanges — un par service destinataire ───────────────────────────────────
EXCHANGE_USER         = "njila.user.exchange"           # → njila-user-service
EXCHANGE_NOTIFICATION = "njila.notification.exchange"   # → njila-notification-service
EXCHANGE_SUBSCRIBE    = "njila.subscribe.exchange"      # → njila-subscribe-service
EXCHANGE_DEAD_LETTER  = "njila.dead.letter.exchange"    # dead letter (direct)

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

    def _try_connect(self):
        """Tente de se connecter à RabbitMQ avec heartbeat court."""
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
                heartbeat=30,  # ← AJOUTÉ : identique au consumer
                blocked_connection_timeout=30,  # ← AJOUTÉ
                connection_attempts=3,
                retry_delay=2,
                socket_timeout=5,
            )
            self._connection = pika.BlockingConnection(params)
            self._channel = self._connection.channel()

            # Déclarer tous les exchanges
            for exchange, ex_type in [
                (EXCHANGE_USER, "topic"),
                (EXCHANGE_NOTIFICATION, "topic"),
                (EXCHANGE_SUBSCRIBE, "topic"),
                (EXCHANGE_DEAD_LETTER, "direct"),
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
            logger.warning("[RABBITMQ] Indisponible au démarrage : %s", e)

    def _ensure_connection(self):
        """Vérifie et restaure la connexion si nécessaire."""
        if not self._connected or not self._connection or not self._connection.is_open:
            logger.warning("[RABBITMQ] Connexion perdue, reconnexion...")
            self._try_connect()
            time.sleep(1)  # Petit délai pour laisser la connexion s'établir

    def publish(self, exchange: str, routing_key: str, payload: dict):
        with self._lock:
            self._ensure_connection()

            if not self._connected:
                logger.error(
                    "[RABBITMQ] Message non publié (indisponible) | exchange=%s key=%s",
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
                logger.debug(
                    "[RABBITMQ] Publié | exchange=%s key=%s", exchange, routing_key
                )
            except (pika.exceptions.AMQPConnectionError, 
                    pika.exceptions.ChannelClosedByBroker,
                    ConnectionResetError) as e:
                logger.error("[RABBITMQ] Erreur publication : %s", e)
                self._connected = False
                # Réessayer une fois
                self._ensure_connection()
                if self._connected:
                    self.publish(exchange, routing_key, payload)

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
        
        # 1. Format pour le service USER (format original)
        user_service_payload = {
            "userId": user_id,
            "email": email,
            "name": name,
            "surname": surname,
            "role": role,
            "phone": phone,
            "adresse": adresse,
            "photoUrl": photo_url,
            "filialeId": filiale_id,
            "agenceId": agence_id,
        }
        
        # 2. Format pour le service BOOKING (avec wrapper type/data)
        booking_payload = {
            "type": "user.registered",
            "data": {
                "userId": user_id,
                "id": user_id,
                "name": name,
                "nom": name,
                "surname": surname,
                "prenom": surname,
                "email": email,
                "phone": phone,
                "telephone": phone,
                "adresse": adresse,
                "address": adresse,
                "photo_portrait_url": photo_url,
                "role": role,
                "agence_id": agence_id,
                "filiale_id": filiale_id,
            }
        }
        
        # Publication pour le service USER avec routing key spécifique
        self.publish(
            exchange=EXCHANGE_USER,           # njila.user.exchange
            routing_key="user.registered",  # ⚠️ Différente
            payload=user_service_payload,
        )
        
        # Publication pour le service BOOKING avec routing key différente
        # MAIS qui match toujours le pattern 'user.#' du booking service
        self.publish(
            exchange=EXCHANGE_USER,           # njila.user.exchange
            routing_key="user.registered.booking",  # ⚠️ Différente aussi
            payload=booking_payload,
        )
        
        # Publication pour le service NOTIFICATION
        self.publish(
            exchange=EXCHANGE_NOTIFICATION,
            routing_key=ROUTING_WELCOME_EMAIL,
            payload={
                "email": email,
                "name": name,
                "surname": surname,
                "type": "welcome",
            },
        )
        
        logger.info("[RABBITMQ] user.registered publié | userId=%s", user_id)

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
        # 1. Format pour le service USER (format original)
        user_service_payload = {
            "userId": user_id,
            "email": email,
            "emailChanged": email_changed,
            "photoUrl": photo_url,
            # Ajout optionnel si ces champs sont fournis
            "name": name,
            "surname": surname,
            "phone": phone,
            "adresse": adresse,
            "role": role,
            "filialeId": filiale_id,
            "agenceId": agence_id,
        }
        
        # 2. Format pour le service BOOKING (avec wrapper type/data)
        booking_payload = {
            "type": "user.updated",  # ou "USER_UPDATED" selon ce que le consumer accepte
            "data": {
                "userId": user_id,
                "id": user_id,
                "email": email,
                "photoUrl": photo_url,
                "photo_portrait_url": photo_url,
                # Inclure tous les champs qui pourraient être mis à jour
                "name": name,
                "nom": name,
                "surname": surname,
                "prenom": surname,
                "phone": phone,
                "telephone": phone,
                "adresse": adresse,
                "address": adresse,
                "role": role,
                "agence_id": agence_id,
                "filiale_id": filiale_id,
            }
        }
        
        # Publication pour le service USER avec routing key spécifique
        self.publish(
            exchange=EXCHANGE_USER,
            routing_key="user.updated",  # Spécifique au service user
            payload=user_service_payload,
        )
        
        # Publication pour le service BOOKING avec routing key différente
        # MAIS qui match toujours le pattern 'user.#' du booking service
        self.publish(
            exchange=EXCHANGE_USER,
            routing_key="user.updated.booking",  # Spécifique au booking
            payload=booking_payload,
        )
        
        logger.info("[RABBITMQ] user.updated publié | userId=%s emailChanged=%s", user_id, email_changed)

    def publish_password_reset(self, email: str, reset_link: str, name: str = ""):
        self.publish(
            exchange=EXCHANGE_NOTIFICATION,
            routing_key=ROUTING_PASSWORD_RESET,
            payload={
                "email": email,
                "name": name,
                "resetLink": reset_link,
                "type": "password_reset",
            },
        )