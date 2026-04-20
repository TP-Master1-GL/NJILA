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
EXCHANGE_FLEET        = "njila.fleet.exchange"          # → booking écoute ici les syncs fleet
EXCHANGE_DEAD_LETTER  = "njila.dead.letter.exchange"

# ============ ROUTING KEYS — publications vers user-service ============
ROUTING_AGENCE_CREATED       = "agence.created"
ROUTING_AGENCE_UPDATED       = "agence.updated"
ROUTING_FILIALE_CREATED      = "filiale.created"
ROUTING_FILIALE_UPDATED      = "filiale.updated"
ROUTING_STAFF_CREATED        = "staff.created"

# ============ ROUTING KEYS — publications vers subscribe-service ============
ROUTING_SUBSCRIPTION_REQUEST = "subscription.request"

# ============ ROUTING KEYS — publications vers notification-service ============
ROUTING_ANNONCE_PUBLISHED    = "annonce.published"
ROUTING_VOYAGE_DELAYED       = "voyage.delayed"
ROUTING_VOYAGE_DEPARTED      = "voyage.departed"
ROUTING_BUS_BREAKDOWN        = "bus.breakdown"
ROUTING_BUS_STATUS_CHANGED   = "bus.status.changed"

# ============ ROUTING KEYS — publications vers booking.exchange ============
# voyage.cancelled va sur booking.exchange car c'est un événement métier
# que le booking-service doit consommer depuis son propre exchange
ROUTING_VOYAGE_CANCELLED     = "voyage.cancelled"

# ============ ROUTING KEYS — publications vers fleet.exchange (sync booking) ============
# Ces routing keys sont dédiées à la synchronisation des données de référence
# vers le booking-service. Le booking bind explicitement ces 4 keys.
ROUTING_AGENCY_UPDATED_SYNC  = "agency.updated"    # → njila.booking.sync.fleet.agency.queue
ROUTING_FILIALE_UPDATED_SYNC = "filiale.updated"   # → njila.booking.sync.fleet.filiale.queue
ROUTING_VOYAGE_UPDATED_SYNC  = "voyage.updated"    # → njila.booking.sync.fleet.voyage.queue
ROUTING_BUS_UPDATED_SYNC     = "bus.updated"       # → njila.booking.sync.fleet.bus.queue


class RabbitMQClient:
    """Client RabbitMQ pour la communication inter-services"""

    def __init__(self):
        self.host     = getattr(settings, 'RABBITMQ_HOST',     'localhost')
        self.port     = getattr(settings, 'RABBITMQ_PORT',     5672)
        self.user     = getattr(settings, 'RABBITMQ_USER',     'guest')
        self.password = getattr(settings, 'RABBITMQ_PASSWORD', 'guest')
        self.vhost    = getattr(settings, 'RABBITMQ_VHOST',    '/')
        self.connection = None
        self.channel    = None
        self._connected = False

    def connect(self):
        try:
            if self.connection and not self.connection.is_closed:
                return True

            credentials = pika.PlainCredentials(self.user, self.password)
            parameters  = pika.ConnectionParameters(
                host=self.host,
                port=self.port,
                virtual_host=self.vhost,
                credentials=credentials,
                # Aligné sur heartbeat=30 de l'auth-service pour cohérence globale
                heartbeat=30,
                blocked_connection_timeout=30,
                connection_attempts=3,
                retry_delay=2,
            )
            self.connection = pika.BlockingConnection(parameters)
            self.channel    = self.connection.channel()

            exchanges = [
                (EXCHANGE_USER,         "topic",  True),
                (EXCHANGE_SUBSCRIBE,    "topic",  True),
                (EXCHANGE_NOTIFICATION, "topic",  True),
                (EXCHANGE_BOOKING,      "topic",  True),
                (EXCHANGE_FLEET,        "topic",  True),
                (EXCHANGE_DEAD_LETTER,  "direct", True),
            ]

            for exchange, ex_type, durable in exchanges:
                self.channel.exchange_declare(
                    exchange=exchange,
                    exchange_type=ex_type,
                    durable=durable,
                )

            self._connected = True
            logger.info("[RABBITMQ] Connecté — exchanges déclarés")
            return True

        except Exception as e:
            self._connected = False
            logger.error("[RABBITMQ] Erreur connexion : %s", e)
            return False

    def publish(self, exchange: str, routing_key: str, message: dict) -> bool:
        try:
            if not self._connected:
                if not self.connect():
                    logger.warning("[RABBITMQ] Message non publié (hors ligne) : key=%s", routing_key)
                    return False

            self.channel.basic_publish(
                exchange=exchange,
                routing_key=routing_key,
                body=json.dumps(message, default=str),
                properties=pika.BasicProperties(
                    delivery_mode=2,
                    content_type='application/json',
                    timestamp=int(timezone.now().timestamp()),
                ),
            )
            logger.info("[RABBITMQ] Publié | exchange=%s key=%s", exchange, routing_key)
            return True

        except Exception as e:
            logger.error("[RABBITMQ] Erreur publication | key=%s : %s", routing_key, e)
            self._connected = False
            return False

    def close(self):
        if self.connection and not self.connection.is_closed:
            self.connection.close()
            logger.info("[RABBITMQ] Connexion fermée")


rabbitmq_client = RabbitMQClient()


# ==============================================================================
# PUBLICATIONS vers user-service
# ==============================================================================

def publish_agence_created(agence):
    """→ user-service"""
    message = {
        'event_type': 'AGENCE_CREATED',
        'agence_id': str(agence.id_agence),
        'nom': agence.name,
        'adresse': agence.adresse,
        'telephone': agence.telephone,
        'email_officiel': agence.email_officiel,
        'timestamp': timezone.now().isoformat(),
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
        'timestamp': timezone.now().isoformat(),
    }
    return rabbitmq_client.publish(EXCHANGE_USER, ROUTING_AGENCE_UPDATED, message)


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
        'timestamp': timezone.now().isoformat(),
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
        'timestamp': timezone.now().isoformat(),
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
        'timestamp': timezone.now().isoformat(),
    }
    return rabbitmq_client.publish(EXCHANGE_USER, ROUTING_STAFF_CREATED, message)


# ==============================================================================
# PUBLICATIONS vers subscribe-service
# ==============================================================================

def publish_agence_subscription_request(agence):
    """→ subscribe-service"""
    message = {
        'event_type': 'SUBSCRIPTION_REQUEST',
        'agence_id': str(agence.id_agence),
        'agence_nom': agence.name,
        'contact_email': agence.email_officiel,
        'contact_telephone': agence.telephone,
        'adresse': agence.adresse,
        'timestamp': timezone.now().isoformat(),
    }
    return rabbitmq_client.publish(EXCHANGE_SUBSCRIBE, ROUTING_SUBSCRIPTION_REQUEST, message)


# ==============================================================================
# PUBLICATIONS vers notification-service
# ==============================================================================

def publish_voyage_delayed(voyage, nouveau_depart):
    """→ notification-service"""
    message = {
        'event_type': 'VOYAGE_DELAYED',
        'voyage_id': str(voyage.Id_voyage),
        'agence_id': str(voyage.IdBus.Id_agence.id_agence),
        'trajet': str(voyage.Id_trajet),
        'date_depart_original': voyage.date_heure_depart.isoformat(),
        'date_depart_nouveau': nouveau_depart.isoformat(),
        'timestamp': timezone.now().isoformat(),
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
        'chauffeur_nom': (
            f"{voyage.id_chauffeur.name} {voyage.id_chauffeur.surname}"
            if voyage.id_chauffeur else None
        ),
        'timestamp': timezone.now().isoformat(),
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
        'timestamp': timezone.now().isoformat(),
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
        'timestamp': timezone.now().isoformat(),
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
        'timestamp': timezone.now().isoformat(),
    }
    return rabbitmq_client.publish(EXCHANGE_NOTIFICATION, ROUTING_ANNONCE_PUBLISHED, message)


# ==============================================================================
# PUBLICATIONS vers booking.exchange — événements métier booking
# ==============================================================================

def publish_voyage_cancelled(voyage, motif):
    """
    → booking-service via booking.exchange / voyage.cancelled
    CORRECTION : était publié sur booking.exchange mais non bindé côté booking.
    Le booking-service bind désormais cette routing key via voyageCancelledBinding().
    """
    message = {
        'event_type': 'VOYAGE_CANCELLED',
        'voyage_id': str(voyage.Id_voyage),
        'agence_id': str(voyage.IdBus.Id_agence.id_agence),
        'trajet': str(voyage.Id_trajet),
        'date_depart': voyage.date_heure_depart.isoformat(),
        'motif': motif,
        'timestamp': timezone.now().isoformat(),
    }
    return rabbitmq_client.publish(EXCHANGE_BOOKING, ROUTING_VOYAGE_CANCELLED, message)


# ==============================================================================
# PUBLICATIONS vers fleet.exchange — synchronisation données de référence
# Le booking-service bind exactement ces 4 routing keys (plus de wildcard fleet.#)
# ==============================================================================

def publish_agency_updated_for_booking(agence):
    """
    → booking-service via fleet.exchange / agency.updated
    Envoyé à la CRÉATION et à chaque MISE À JOUR d'une agence.
    """
    message = {
        'event_type': 'AGENCY_UPDATED',
        'code': str(agence.id_agence),
        'name': agence.name,
        'ville': agence.adresse,
        'logoUrl': getattr(agence, 'logo_url', None),
        'telephone': agence.telephone,
        'email': agence.email_officiel,
        'statut': agence.statut_global,
        'timestamp': timezone.now().isoformat(),
    }
    return rabbitmq_client.publish(EXCHANGE_FLEET, ROUTING_AGENCY_UPDATED_SYNC, message)


def publish_filiale_updated_for_booking(filiale):
    """
    → booking-service via fleet.exchange / filiale.updated
    Envoyé à la CRÉATION et à chaque MISE À JOUR d'une filiale.
    """
    message = {
        'event_type': 'FILIALE_UPDATED',
        'code': filiale.code,
        'name': filiale.nom,
        'ville': filiale.ville,
        'agence_code': str(filiale.agence.id_agence),
        'telephone': filiale.telephone,
        'email': filiale.email,
        'est_active': filiale.est_active,
        'timestamp': timezone.now().isoformat(),
    }
    return rabbitmq_client.publish(EXCHANGE_FLEET, ROUTING_FILIALE_UPDATED_SYNC, message)


def publish_voyage_updated_for_booking(voyage):
    """
    → booking-service via fleet.exchange / voyage.updated
    Envoyé à la CRÉATION, à chaque MISE À JOUR et à chaque CHANGEMENT DE STATUT.
    """
    trajet = voyage.Id_trajet
    bus    = voyage.IdBus

    message = {
        'event_type': 'VOYAGE_UPDATED',
        'voyage_id': str(voyage.Id_voyage),
        'status': voyage.status,
        'type_voyage': voyage.type_voyage,
        'prix': str(voyage.prix),
        'places_disponibles': voyage.places_disponibles,
        'places_total_reservees': getattr(voyage, 'places_total_reservees', 0),
        'date_heure_depart': voyage.date_heure_depart.isoformat(),
        'date_heure_arrive_prevue': (
            voyage.date_heure_arrive_prevue.isoformat()
            if getattr(voyage, 'date_heure_arrive_prevue', None) else None
        ),
        'origine': {
            'filiale_code': trajet.filiale_depart.code if trajet else None,
            'filiale_nom':  trajet.filiale_depart.nom  if trajet else None,
            'ville':        trajet.filiale_depart.ville if trajet else None,
        },
        'destination': {
            'filiale_code': trajet.filiale_arrive.code if trajet else None,
            'filiale_nom':  trajet.filiale_arrive.nom  if trajet else None,
            'ville':        trajet.filiale_arrive.ville if trajet else None,
        },
        'bus': {
            'bus_id':          bus.IdBus            if bus else None,
            'immatriculation': bus.immatriculation  if bus else None,
            'modele':          bus.modele            if bus else None,
            'capacite':        bus.capacite          if bus else None,
            'etat':            bus.etat              if bus else None,
        },
        'agence_code': str(bus.Id_agence.id_agence) if bus else None,
        'timestamp': timezone.now().isoformat(),
    }
    return rabbitmq_client.publish(EXCHANGE_FLEET, ROUTING_VOYAGE_UPDATED_SYNC, message)


def publish_bus_updated_for_booking(bus):
    """
    → booking-service via fleet.exchange / bus.updated
    Envoyé à la CRÉATION et à chaque CHANGEMENT D'ÉTAT d'un bus.
    """
    message = {
        'event_type': 'BUS_UPDATED',
        'bus_id': bus.IdBus,
        'immatriculation': bus.immatriculation,
        'modele': bus.modele,
        'capacite': bus.capacite,
        'etat': bus.etat,
        'agence_code': str(bus.Id_agence.id_agence),
        'timestamp': timezone.now().isoformat(),
    }
    return rabbitmq_client.publish(EXCHANGE_FLEET, ROUTING_BUS_UPDATED_SYNC, message)