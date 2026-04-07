import pika
import json
import logging
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)

# ============ EXCHANGES DES SERVICES DESTINATAIRES ============
EXCHANGE_USER         = "njila.user.exchange"           # → user-service
EXCHANGE_SUBSCRIBE    = "njila.subscribe.exchange"      # → subscribe-service
EXCHANGE_NOTIFICATION = "njila.notification.exchange"   # → notification-service
EXCHANGE_BOOKING      = "njila.booking.exchange"        # → booking-service
EXCHANGE_FLEET        = "njila.fleet.exchange"          # → pour consommation interne
EXCHANGE_DEAD_LETTER  = "njila.dead.letter.exchange"

# ============ ROUTING KEYS ============
ROUTING_AGENCE_CREATED   = "agence.created"
ROUTING_AGENCE_UPDATED   = "agence.updated"
ROUTING_FILIALE_CREATED  = "filiale.created"
ROUTING_FILIALE_UPDATED  = "filiale.updated"
ROUTING_STAFF_CREATED    = "staff.created"
ROUTING_SUBSCRIPTION_REQUEST = "subscription.request"
ROUTING_ANNONCE_PUBLISHED = "annonce.published"
ROUTING_VOYAGE_DELAYED    = "voyage.delayed"
ROUTING_VOYAGE_DEPARTED   = "voyage.departed"
ROUTING_VOYAGE_CANCELLED  = "voyage.cancelled"
ROUTING_BUS_BREAKDOWN     = "bus.breakdown"
ROUTING_BUS_STATUS_CHANGED = "bus.status.changed"

class RabbitMQClient:
    """Client RabbitMQ pour la communication inter-services"""

    def __init__(self):
        self.host = getattr(settings, 'RABBITMQ_HOST', 'localhost')
        self.port = getattr(settings, 'RABBITMQ_PORT', 5672)
        self.user = getattr(settings, 'RABBITMQ_USER', 'guest')
        self.password = getattr(settings, 'RABBITMQ_PASSWORD', 'guest')
        self.vhost = getattr(settings, 'RABBITMQ_VHOST', '/')
        self.connection = None
        self.channel = None
        self._connected = False

    def connect(self):
        try:
            if self.connection and not self.connection.is_closed:
                return True

            credentials = pika.PlainCredentials(self.user, self.password)
            parameters = pika.ConnectionParameters(
                host=self.host,
                port=self.port,
                virtual_host=self.vhost,
                credentials=credentials,
                heartbeat=600,
                blocked_connection_timeout=300,
                connection_attempts=3,
                retry_delay=2,
            )
            self.connection = pika.BlockingConnection(parameters)
            self.channel = self.connection.channel()

            # Déclarer TOUS les exchanges
            exchanges = [
                (EXCHANGE_USER, "topic", True),
                (EXCHANGE_SUBSCRIBE, "topic", True),
                (EXCHANGE_NOTIFICATION, "topic", True),
                (EXCHANGE_BOOKING, "topic", True),
                (EXCHANGE_FLEET, "topic", True),
                (EXCHANGE_DEAD_LETTER, "direct", True),
            ]

            for exchange, ex_type, durable in exchanges:
                self.channel.exchange_declare(
                    exchange=exchange,
                    exchange_type=ex_type,
                    durable=durable
                )

            self._connected = True
            logger.info("[RABBITMQ] Connecté - Exchanges déclarés")
            return True

        except Exception as e:
            self._connected = False
            logger.error(f"[RABBITMQ] Erreur connexion: {e}")
            return False

    def publish(self, exchange: str, routing_key: str, message: dict):
        try:
            if not self._connected:
                if not self.connect():
                    logger.warning(f"[RABBITMQ] Message non publié: {routing_key}")
                    return False

            self.channel.basic_publish(
                exchange=exchange,
                routing_key=routing_key,
                body=json.dumps(message, default=str),
                properties=pika.BasicProperties(
                    delivery_mode=2,
                    content_type='application/json',
                    timestamp=int(timezone.now().timestamp())
                )
            )
            logger.info(f"[RABBITMQ] Publié | exchange={exchange} key={routing_key}")
            return True
        except Exception as e:
            logger.error(f"[RABBITMQ] Erreur publication: {e}")
            self._connected = False
            return False

    def close(self):
        if self.connection and not self.connection.is_closed:
            self.connection.close()
            logger.info("[RABBITMQ] Connexion fermée")

rabbitmq_client = RabbitMQClient()


# ============ FONCTIONS DE PUBLICATION ============

def publish_agence_created(agence):
    """→ user-service"""
    message = {
        'event_type': 'AGENCE_CREATED',
        'agence_id': str(agence.id_agence),
        'nom': agence.name,
        'adresse': agence.adresse,
        'telephone': agence.telephone,
        'email_officiel': agence.email_officiel,
        'timestamp': timezone.now().isoformat()
    }
    return rabbitmq_client.publish(EXCHANGE_USER, ROUTING_AGENCE_CREATED, message)

def publish_agence_updated(agence):
    """→ user-service"""
    message = {
        'event_type': 'AGENCE_UPDATED',
        'agence_id': str(agence.id_agence),
        'nom': agence.name,
        'telephone': agence.telephone,
        'email_officiel': agence.email_officiel,
        'statut_global': agence.statut_global,
        'timestamp': timezone.now().isoformat()
    }
    return rabbitmq_client.publish(EXCHANGE_USER, ROUTING_AGENCE_UPDATED, message)

def publish_agence_subscription_request(agence):
    """→ subscribe-service"""
    message = {
        'event_type': 'SUBSCRIPTION_REQUEST',
        'agence_id': str(agence.id_agence),
        'agence_nom': agence.name,
        'contact_email': agence.email_officiel,
        'contact_telephone': agence.telephone,
        'adresse': agence.adresse,
        'timestamp': timezone.now().isoformat()
    }
    return rabbitmq_client.publish(EXCHANGE_SUBSCRIBE, ROUTING_SUBSCRIPTION_REQUEST, message)

def publish_filiale_created(filiale):
    """→ user-service"""
    message = {
        'event_type': 'FILIALE_CREATED',
        'filiale_id': str(filiale.id_filiale),
        'agence_id': str(filiale.agence.id_agence),
        'nom': filiale.nom,
        'code': filiale.code,
        'adresse': filiale.adresse,
        'ville': filiale.ville,
        'telephone': filiale.telephone,
        'email': filiale.email,
        'timestamp': timezone.now().isoformat()
    }
    return rabbitmq_client.publish(EXCHANGE_USER, ROUTING_FILIALE_CREATED, message)

def publish_filiale_updated(filiale):
    """→ user-service"""
    message = {
        'event_type': 'FILIALE_UPDATED',
        'filiale_id': str(filiale.id_filiale),
        'agence_id': str(filiale.agence.id_agence),
        'nom': filiale.nom,
        'code': filiale.code,
        'ville': filiale.ville,
        'telephone': filiale.telephone,
        'email': filiale.email,
        'est_active': filiale.est_active,
        'timestamp': timezone.now().isoformat()
    }
    return rabbitmq_client.publish(EXCHANGE_USER, ROUTING_FILIALE_UPDATED, message)

def publish_staff_created(user_id, role, filiale_id=None, agence_id=None):
    """→ auth-service (via user.exchange)"""
    message = {
        'event_type': 'STAFF_CREATED',
        'user_id': str(user_id),
        'role': role,
        'filiale_id': str(filiale_id) if filiale_id else None,
        'agence_id': str(agence_id) if agence_id else None,
        'timestamp': timezone.now().isoformat()
    }
    return rabbitmq_client.publish(EXCHANGE_USER, ROUTING_STAFF_CREATED, message)

def publish_voyage_cancelled(voyage, motif):
    """→ booking-service"""
    message = {
        'event_type': 'VOYAGE_CANCELLED',
        'voyage_id': str(voyage.Id_voyage),
        'agence_id': str(voyage.IdBus.Id_agence.id_agence),
        'trajet': str(voyage.Id_trajet),
        'date_depart': voyage.date_heure_depart.isoformat(),
        'motif': motif,
        'timestamp': timezone.now().isoformat()
    }
    return rabbitmq_client.publish(EXCHANGE_BOOKING, ROUTING_VOYAGE_CANCELLED, message)

def publish_voyage_delayed(voyage, nouveau_depart):
    """→ notification-service"""
    message = {
        'event_type': 'VOYAGE_DELAYED',
        'voyage_id': str(voyage.Id_voyage),
        'agence_id': str(voyage.IdBus.Id_agence.id_agence),
        'trajet': str(voyage.Id_trajet),
        'date_depart_original': voyage.date_heure_depart.isoformat(),
        'date_depart_nouveau': nouveau_depart.isoformat(),
        'timestamp': timezone.now().isoformat()
    }
    return rabbitmq_client.publish(EXCHANGE_NOTIFICATION, ROUTING_VOYAGE_DELAYED, message)

def publish_voyage_departed(voyage):
    """→ notification-service"""
    message = {
        'event_type': 'VOYAGE_DEPARTED',
        'voyage_id': str(voyage.Id_voyage),
        'agence_id': str(voyage.IdBus.Id_agence.id_agence),
        'trajet': str(voyage.Id_trajet),
        'date_depart': voyage.date_heure_depart.isoformat(),
        'bus_immatriculation': voyage.IdBus.immatriculation,
        'chauffeur_nom': f"{voyage.id_chauffeur.name} {voyage.id_chauffeur.surname}" if voyage.id_chauffeur else None,
        'timestamp': timezone.now().isoformat()
    }
    return rabbitmq_client.publish(EXCHANGE_NOTIFICATION, ROUTING_VOYAGE_DEPARTED, message)

def publish_bus_status_changed(bus, ancien_status, nouveau_status, raison):
    """→ notification-service"""
    message = {
        'event_type': 'BUS_STATUS_CHANGED',
        'bus_id': bus.IdBus,
        'immatriculation': bus.immatriculation,
        'ancien_status': ancien_status,
        'nouveau_status': nouveau_status,
        'raison': raison,
        'agence_id': str(bus.Id_agence.id_agence),
        'timestamp': timezone.now().isoformat()
    }
    return rabbitmq_client.publish(EXCHANGE_NOTIFICATION, ROUTING_BUS_STATUS_CHANGED, message)

def publish_bus_breakdown(bus, motif):
    """→ notification-service"""
    message = {
        'event_type': 'BUS_BREAKDOWN',
        'bus_id': bus.IdBus,
        'immatriculation': bus.immatriculation,
        'agence_id': str(bus.Id_agence.id_agence),
        'motif': motif,
        'timestamp': timezone.now().isoformat()
    }
    return rabbitmq_client.publish(EXCHANGE_NOTIFICATION, ROUTING_BUS_BREAKDOWN, message)

def publish_annonce_published(annonce):
    """→ notification-service"""
    message = {
        'event_type': 'ANNONCE_PUBLISHED',
        'annonce_id': str(annonce.id_annonce),
        'type': annonce.type,
        'message': annonce.message,
        'voyage_id': str(annonce.Id_voyage.Id_voyage),
        'timestamp': timezone.now().isoformat()
    }
    return rabbitmq_client.publish(EXCHANGE_NOTIFICATION, ROUTING_ANNONCE_PUBLISHED, message)