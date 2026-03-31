"""
EventPublisher — publication RabbitMQ depuis l'auth-service.

Architecture des exchanges NJILA (corrigée) :
  Chaque service possède son propre exchange. L'auth-service publie sur
  l'exchange du service destinataire, pas sur le sien propre.

  ┌─────────────────────────────────────────────────────────────────┐
  │  Message publié par auth-service     Exchange cible             │
  ├─────────────────────────────────────────────────────────────────┤
  │  user.registered  (profil initial)   njila.user.exchange        │
  │  user.updated     (email changé)     njila.user.exchange        │
  │  staff.created    (nouveau staff)    njila.user.exchange        │
  │  password.reset   (lien email)       njila.notification.exchange│
  │  welcome.email    (email bienvenue)  njila.notification.exchange│
  │  subscription.check (vérif. abo.)    njila.subscribe.exchange   │
  └─────────────────────────────────────────────────────────────────┘

Dead Letter Exchange : njila.dead.letter.exchange (direct)
"""

import json
import logging
import threading
from typing import Optional

logger = logging.getLogger(__name__)

# ── Exchanges — un par service destinataire ───────────────────────────────────
EXCHANGE_USER         = "njila.user.exchange"           # → njila-user-service
EXCHANGE_NOTIFICATION = "njila.notification.exchange"   # → njila-notification-service
EXCHANGE_SUBSCRIBE    = "njila.subscribe.exchange"      # → njila-subscribe-service
EXCHANGE_DEAD_LETTER  = "njila.dead.letter.exchange"    # dead letter (direct)

# ── Routing keys ──────────────────────────────────────────────────────────────
# → njila.user.exchange
ROUTING_USER_REGISTERED = "user.registered"   # profil initial après inscription
ROUTING_USER_UPDATED    = "user.updated"      # invalider tokens si email changé
ROUTING_STAFF_CREATED   = "staff.created"     # nouveau staff créé par user-service

# → njila.notification.exchange
ROUTING_PASSWORD_RESET  = "auth.password.reset"   # email de réinitialisation
ROUTING_WELCOME_EMAIL   = "auth.user.welcome"     # email de bienvenue


class EventPublisher:
    """
    Publie des événements vers les exchanges des services destinataires.
    Une seule connexion RabbitMQ, plusieurs exchanges déclarés au démarrage.
    Connexion lazy + reconnexion automatique. Non bloquant si RabbitMQ est down.
    """

    def __init__(self):
        self._lock      = threading.Lock()
        self._connection = None
        self._channel   = None
        self._connected = False
        self._try_connect()

    def _try_connect(self):
        try:
            import pika
            from django.conf import settings

            params = pika.ConnectionParameters(
                host          = getattr(settings, "RABBITMQ_HOST",  "localhost"),
                port          = int(getattr(settings, "RABBITMQ_PORT", 5672)),
                virtual_host  = getattr(settings, "RABBITMQ_VHOST", "/"),
                credentials   = pika.PlainCredentials(
                    username  = getattr(settings, "RABBITMQ_USER", "guest"),
                    password  = getattr(settings, "RABBITMQ_PASS", "guest"),
                ),
                connection_attempts = 3,
                retry_delay         = 2,
                socket_timeout      = 5,
            )
            self._connection = pika.BlockingConnection(params)
            self._channel    = self._connection.channel()

            # Déclarer TOUS les exchanges utilisés par l'auth-service
            for exchange, ex_type in [
                (EXCHANGE_USER,         "topic"),
                (EXCHANGE_NOTIFICATION, "topic"),
                (EXCHANGE_SUBSCRIBE,    "topic"),
                (EXCHANGE_DEAD_LETTER,  "direct"),
            ]:
                self._channel.exchange_declare(
                    exchange      = exchange,
                    exchange_type = ex_type,
                    durable       = True,
                )

            self._connected = True
            logger.info(
                "[RABBITMQ] Connexion établie — exchanges: %s | %s | %s",
                EXCHANGE_USER, EXCHANGE_NOTIFICATION, EXCHANGE_SUBSCRIBE,
            )

        except Exception as e:
            self._connected = False
            logger.warning("[RABBITMQ] Indisponible au démarrage : %s", e)

    def publish(self, exchange: str, routing_key: str, payload: dict):
        """
        Publie un message JSON sur l'exchange spécifié.
        Paramètres :
          exchange    : exchange du SERVICE DESTINATAIRE
          routing_key : clé de routage
          payload     : données JSON sérialisables
        """
        with self._lock:
            if not self._connected:
                self._try_connect()

            if not self._connected:
                logger.error(
                    "[RABBITMQ] Message non publié (indisponible) | exchange=%s key=%s",
                    exchange, routing_key,
                )
                return

            try:
                import pika
                self._channel.basic_publish(
                    exchange    = exchange,
                    routing_key = routing_key,
                    body        = json.dumps(payload),
                    properties  = pika.BasicProperties(
                        delivery_mode = 2,               # message persistant
                        content_type  = "application/json",
                    ),
                )
                logger.debug(
                    "[RABBITMQ] Publié | exchange=%s key=%s", exchange, routing_key
                )
            except Exception as e:
                logger.error("[RABBITMQ] Erreur publication : %s", e)
                self._connected = False

    # ─── Méthodes métier ──────────────────────────────────────────────────────

    def publish_user_registered(
        self,
        user_id:       str,
        email:         str,
        nom:           str,
        prenom:        str,
        role:          str,
        photo_url:     Optional[str] = None,
        filiale_id:    Optional[str] = None,
        agence_id:     Optional[str] = None,
    ):
        """
        Publie sur njila.user.exchange → user-service crée le profil initial.
        Publie sur njila.notification.exchange → notification-service envoie l'email de bienvenue.
        """
        profile_payload = {
            "userId":    user_id,
            "email":     email,
            "nom":       nom,
            "prenom":    prenom,
            "role":      role,
            "photoUrl":  photo_url,
            "filialeId": filiale_id,
            "agenceId":  agence_id,
        }
        # → user-service : création du profil
        self.publish(
            exchange    = EXCHANGE_USER,
            routing_key = ROUTING_USER_REGISTERED,
            payload     = profile_payload,
        )
        # → notification-service : email de bienvenue
        self.publish(
            exchange    = EXCHANGE_NOTIFICATION,
            routing_key = ROUTING_WELCOME_EMAIL,
            payload     = {
                "email":  email,
                "nom":    nom,
                "prenom": prenom,
                "type":   "welcome",
            },
        )

    def publish_user_updated(
        self,
        user_id:       str,
        email:         str,
        email_changed: bool = False,
        photo_url:     Optional[str] = None,
    ):
        """
        Publie sur njila.user.exchange → user-service met à jour le profil.
        Si email changé : l'auth-service s'auto-consommera pour invalider les tokens.
        """
        self.publish(
            exchange    = EXCHANGE_USER,
            routing_key = ROUTING_USER_UPDATED,
            payload     = {
                "userId":       user_id,
                "email":        email,
                "emailChanged": email_changed,
                "photoUrl":     photo_url,
            },
        )

    def publish_password_reset(self, email: str, reset_link: str, name: str = ""):
        """
        Publie sur njila.notification.exchange → notification-service envoie l'email de reset.
        NE publie PLUS sur njila.user.exchange.
        """
        self.publish(
            exchange    = EXCHANGE_NOTIFICATION,
            routing_key = ROUTING_PASSWORD_RESET,
            payload     = {
                "email":     email,
                "name":      name,   # prénom pour personnaliser l'email
                "resetLink": reset_link,
                "type":      "password_reset",
            },
        )

    def publish_staff_created(
        self,
        user_id:    str,
        email:      str,
        role:       str,
        filiale_id: Optional[str] = None,
        agence_id:  Optional[str] = None,
    ):
        """
        Publie sur njila.user.exchange → user-service crée le profil du staff.
        """
        self.publish(
            exchange    = EXCHANGE_USER,
            routing_key = ROUTING_STAFF_CREATED,
            payload     = {
                "userId":    user_id,
                "email":     email,
                "role":      role,
                "filialeId": filiale_id,
                "agenceId":  agence_id,
            },
        )