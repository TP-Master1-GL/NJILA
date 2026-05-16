import pika
import json
import logging
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)

# ============ EXCHANGES DES SERVICES DESTINATAIRES ============
EXCHANGE_USER         = "njila.user.exchange"
EXCHANGE_SUBSCRIBE    = "njila.subscribe.exchange"
EXCHANGE_NOTIFICATION = "njila.notification.exchange"
EXCHANGE_BOOKING      = "njila.booking.exchange"
EXCHANGE_FLEET        = "njila.fleet.exchange"
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
ROUTING_VOYAGE_CANCELLED     = "voyage.cancelled"

# ============ ROUTING KEYS — publications vers fleet.exchange (sync booking) ============
ROUTING_AGENCY_UPDATED_SYNC  = "agency.updated"
ROUTING_FILIALE_UPDATED_SYNC = "filiale.updated"
ROUTING_VOYAGE_UPDATED_SYNC  = "voyage.updated"
ROUTING_BUS_UPDATED_SYNC     = "bus.updated"

# ============ MAPPING exchange → service destinataire (pour les logs) ============
EXCHANGE_SERVICE_MAP = {
    EXCHANGE_USER:         "user-service",
    EXCHANGE_SUBSCRIBE:    "subscribe-service",
    EXCHANGE_NOTIFICATION: "notification-service",
    EXCHANGE_BOOKING:      "booking-service",
    EXCHANGE_FLEET:        "fleet-service (sync booking)",
    EXCHANGE_DEAD_LETTER:  "dead-letter-queue",
}

# ─────────────────────────────────────────────────────────────────────────────
# CORRECTION PRINCIPALE : connexion par publication (connect-publish-close)
#
# Problème d'origine : RabbitMQClient maintenait une seule BlockingConnection
# partagée entre tous les threads Django (workers Gunicorn / uWSGI).
# BlockingConnection n'est PAS thread-safe : deux threads publiant en même
# temps corrompent le canal TCP → ConnectionResetError(104).
# Le heartbeat à 30 s aggravait le problème : une connexion idle entre deux
# requêtes expiraient côté broker avant d'être réutilisée.
#
# Solution : _get_parameters() construit les paramètres de connexion une seule
# fois ; publish() ouvre une connexion dédiée, publie, puis ferme.
# Coût : ~5-10 ms par publication — négligeable pour un bus d'événements métier.
# Si les volumes montent (>50 msg/s), migrez vers aio-pika (asyncio) ou un
# pool de connexions thread-local (threading.local()).
# ─────────────────────────────────────────────────────────────────────────────

def _get_connection_params() -> pika.ConnectionParameters:
    """Retourne les paramètres de connexion (lu depuis settings Django)."""
    return pika.ConnectionParameters(
        host=getattr(settings, 'RABBITMQ_HOST',     'njila-rabbitmq'),
        port=getattr(settings, 'RABBITMQ_PORT',     5672),
        virtual_host=getattr(settings, 'RABBITMQ_VHOST', '/'),
        credentials=pika.PlainCredentials(
            username=getattr(settings, 'RABBITMQ_USER',     'guest'),
            password=getattr(settings, 'RABBITMQ_PASSWORD', 'guest'),
        ),
        # heartbeat à 60 s : assez long pour survivre aux workers idle,
        # assez court pour détecter rapidement une déconnexion réseau.
        heartbeat=60,
        blocked_connection_timeout=30,
        connection_attempts=3,
        retry_delay=2,
        socket_timeout=10,
    )


_EXCHANGES = [
    (EXCHANGE_USER,         "topic",  True),
    (EXCHANGE_SUBSCRIBE,    "topic",  True),
    (EXCHANGE_NOTIFICATION, "topic",  True),
    (EXCHANGE_BOOKING,      "topic",  True),
    (EXCHANGE_FLEET,        "topic",  True),
    (EXCHANGE_DEAD_LETTER,  "direct", True),
]


def publish(exchange: str, routing_key: str, message: dict) -> bool:
    """
    Ouvre une connexion RabbitMQ dédiée, publie le message, puis ferme.

    Thread-safe : chaque appel possède sa propre connexion TCP.
    Retente une fois en cas d'erreur réseau transitoire.
    """
    service = EXCHANGE_SERVICE_MAP.get(exchange, exchange)
    params  = _get_connection_params()

    for attempt in range(1, 3):          # 2 tentatives maximum
        connection = None
        try:
            connection = pika.BlockingConnection(params)
            channel    = connection.channel()

            # Déclare uniquement l'exchange cible (idempotent si déjà déclaré).
            ex_type = "direct" if exchange == EXCHANGE_DEAD_LETTER else "topic"
            channel.exchange_declare(exchange=exchange, exchange_type=ex_type, durable=True)

            channel.basic_publish(
                exchange=exchange,
                routing_key=routing_key,
                body=json.dumps(message, default=str),
                properties=pika.BasicProperties(
                    delivery_mode=2,              # message persistant
                    content_type='application/json',
                    timestamp=int(timezone.now().timestamp()),
                ),
            )
            logger.info(
                "[RABBITMQ] ✓ Message publié | destinataire=%s exchange=%s routing_key=%s",
                service, exchange, routing_key,
            )
            return True

        except (
            pika.exceptions.AMQPConnectionError,
            pika.exceptions.AMQPChannelError,
            pika.exceptions.StreamLostError,
            ConnectionResetError,
        ) as e:
            logger.warning(
                "[RABBITMQ] Échec réseau (tentative %d/2) | destinataire=%s "
                "exchange=%s routing_key=%s | erreur=%s",
                attempt, service, exchange, routing_key, e,
            )
            # Laisse la boucle retenter

        except Exception as e:
            logger.error(
                "[RABBITMQ] Erreur inattendue | destinataire=%s exchange=%s routing_key=%s | erreur=%s",
                service, exchange, routing_key, e,
            )
            return False   # Pas de retry sur erreur inconnue

        finally:
            # Fermeture propre quelle que soit l'issue
            if connection is not None:
                try:
                    if not connection.is_closed:
                        connection.close()
                except Exception:
                    pass

    logger.error(
        "[RABBITMQ] ✗ Abandon après 2 tentatives — message perdu "
        "| destinataire=%s exchange=%s routing_key=%s",
        service, exchange, routing_key,
    )
    return False


# ─────────────────────────────────────────────────────────────────────────────
# COMPATIBILITÉ : rabbitmq_client.publish(...) toujours fonctionnel
# Les views qui appellent rabbitmq_client.publish() n'ont rien à changer.
# ─────────────────────────────────────────────────────────────────────────────

class _Compat:
    """Façade de compatibilité — délègue à la fonction publish() module-level."""
    @staticmethod
    def publish(exchange: str, routing_key: str, message: dict) -> bool:
        return publish(exchange, routing_key, message)

rabbitmq_client = _Compat()


# ==============================================================================
# PUBLICATIONS vers user-service
# ==============================================================================

def publish_agence_created(agence):
    logger.info(
        "[EVENT] Envoi AGENCE_CREATED → destinataire=user-service | exchange=%s | routing_key=%s | agence_id=%s",
        EXCHANGE_USER, ROUTING_AGENCE_CREATED, agence.id_agence,
    )
    message = {
        'event_type': 'AGENCE_CREATED',
        'agence_id': str(agence.id_agence),
        'nom': agence.name,
        'adresse': agence.adresse,
        'telephone': agence.telephone,
        'email_officiel': agence.email_officiel,
        'timestamp': timezone.now().isoformat(),
    }
    success = publish(EXCHANGE_USER, ROUTING_AGENCE_CREATED, message)
    if not success:
        logger.error(
            "[EVENT] Échec publication AGENCE_CREATED → user-service | agence_id=%s",
            agence.id_agence,
        )
    return success


def publish_agence_updated(agence):
    logger.info(
        "[EVENT] Envoi AGENCE_UPDATED → destinataire=user-service | exchange=%s | routing_key=%s | agence_id=%s",
        EXCHANGE_USER, ROUTING_AGENCE_UPDATED, agence.id_agence,
    )
    message = {
        'event_type': 'AGENCE_UPDATED',
        'agence_id': str(agence.id_agence),
        'nom': agence.name,
        'telephone': agence.telephone,
        'email_officiel': agence.email_officiel,
        'statut_global': agence.statut_global,
        'timestamp': timezone.now().isoformat(),
    }
    success = publish(EXCHANGE_USER, ROUTING_AGENCE_UPDATED, message)
    if not success:
        logger.error(
            "[EVENT] Échec publication AGENCE_UPDATED → user-service | agence_id=%s",
            agence.id_agence,
        )
    return success


def publish_filiale_created(filiale):
    logger.info(
        "[EVENT] Envoi FILIALE_CREATED → destinataire=user-service | exchange=%s | routing_key=%s "
        "| filiale_id=%s agence_id=%s",
        EXCHANGE_USER, ROUTING_FILIALE_CREATED, filiale.id_filiale, filiale.agence.id_agence,
    )
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
    success = publish(EXCHANGE_USER, ROUTING_FILIALE_CREATED, message)
    if not success:
        logger.error(
            "[EVENT] Échec publication FILIALE_CREATED → user-service | filiale_id=%s",
            filiale.id_filiale,
        )
    return success


def publish_filiale_updated(filiale):
    logger.info(
        "[EVENT] Envoi FILIALE_UPDATED → destinataire=user-service | exchange=%s | routing_key=%s "
        "| filiale_id=%s agence_id=%s",
        EXCHANGE_USER, ROUTING_FILIALE_UPDATED, filiale.id_filiale, filiale.agence.id_agence,
    )
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
    success = publish(EXCHANGE_USER, ROUTING_FILIALE_UPDATED, message)
    if not success:
        logger.error(
            "[EVENT] Échec publication FILIALE_UPDATED → user-service | filiale_id=%s",
            filiale.id_filiale,
        )
    return success


def publish_staff_created(user_id, role, filiale_id=None, agence_id=None):
    logger.info(
        "[EVENT] Envoi STAFF_CREATED → destinataire=user-service | exchange=%s | routing_key=%s "
        "| user_id=%s role=%s filiale_id=%s agence_id=%s",
        EXCHANGE_USER, ROUTING_STAFF_CREATED, user_id, role, filiale_id, agence_id,
    )
    message = {
        'event_type': 'STAFF_CREATED',
        'user_id': str(user_id),
        'role': role,
        'filiale_id': str(filiale_id) if filiale_id else None,
        'agence_id': str(agence_id) if agence_id else None,
        'timestamp': timezone.now().isoformat(),
    }
    success = publish(EXCHANGE_USER, ROUTING_STAFF_CREATED, message)
    if not success:
        logger.error(
            "[EVENT] Échec publication STAFF_CREATED → user-service | user_id=%s role=%s",
            user_id, role,
        )
    return success


# ==============================================================================
# PUBLICATIONS vers subscribe-service
# ==============================================================================

def publish_agence_subscription_request(agence):
    logger.info(
        "[EVENT] Envoi SUBSCRIPTION_REQUEST → destinataire=subscribe-service | exchange=%s | routing_key=%s "
        "| agence_id=%s",
        EXCHANGE_SUBSCRIBE, ROUTING_SUBSCRIPTION_REQUEST, agence.id_agence,
    )
    message = {
        'event_type': 'SUBSCRIPTION_REQUEST',
        'agence_id': str(agence.id_agence),
        'agence_nom': agence.name,
        'contact_email': agence.email_officiel,
        'contact_telephone': agence.telephone,
        'adresse': agence.adresse,
        'timestamp': timezone.now().isoformat(),
    }
    success = publish(EXCHANGE_SUBSCRIBE, ROUTING_SUBSCRIPTION_REQUEST, message)
    if not success:
        logger.error(
            "[EVENT] Échec publication SUBSCRIPTION_REQUEST → subscribe-service | agence_id=%s",
            agence.id_agence,
        )
    return success


# ==============================================================================
# PUBLICATIONS vers notification-service
# ==============================================================================

def publish_voyage_delayed(voyage, nouveau_depart):
    logger.info(
        "[EVENT] Envoi VOYAGE_DELAYED → destinataire=notification-service | exchange=%s | routing_key=%s "
        "| voyage_id=%s nouveau_depart=%s",
        EXCHANGE_NOTIFICATION, ROUTING_VOYAGE_DELAYED, voyage.Id_voyage, nouveau_depart,
    )
    message = {
        'event_type': 'VOYAGE_DELAYED',
        'voyage_id': str(voyage.Id_voyage),
        'agence_id': str(voyage.IdBus.Id_agence.id_agence),
        'trajet': str(voyage.Id_trajet),
        'date_depart_original': voyage.date_heure_depart.isoformat(),
        'date_depart_nouveau': nouveau_depart.isoformat(),
        'timestamp': timezone.now().isoformat(),
    }
    success = publish(EXCHANGE_NOTIFICATION, ROUTING_VOYAGE_DELAYED, message)
    if not success:
        logger.error(
            "[EVENT] Échec publication VOYAGE_DELAYED → notification-service | voyage_id=%s",
            voyage.Id_voyage,
        )
    return success


def publish_voyage_departed(voyage):
    logger.info(
        "[EVENT] Envoi VOYAGE_DEPARTED → destinataire=notification-service | exchange=%s | routing_key=%s "
        "| voyage_id=%s",
        EXCHANGE_NOTIFICATION, ROUTING_VOYAGE_DEPARTED, voyage.Id_voyage,
    )
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
    success = publish(EXCHANGE_NOTIFICATION, ROUTING_VOYAGE_DEPARTED, message)
    if not success:
        logger.error(
            "[EVENT] Échec publication VOYAGE_DEPARTED → notification-service | voyage_id=%s",
            voyage.Id_voyage,
        )
    return success


def publish_bus_status_changed(bus, ancien_status, nouveau_status, raison):
    logger.info(
        "[EVENT] Envoi BUS_STATUS_CHANGED → destinataire=notification-service | exchange=%s | routing_key=%s "
        "| bus_id=%s %s → %s",
        EXCHANGE_NOTIFICATION, ROUTING_BUS_STATUS_CHANGED, bus.IdBus, ancien_status, nouveau_status,
    )
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
    success = publish(EXCHANGE_NOTIFICATION, ROUTING_BUS_STATUS_CHANGED, message)
    if not success:
        logger.error(
            "[EVENT] Échec publication BUS_STATUS_CHANGED → notification-service | bus_id=%s",
            bus.IdBus,
        )
    return success


def publish_bus_breakdown(bus, motif):
    logger.info(
        "[EVENT] Envoi BUS_BREAKDOWN → destinataire=notification-service | exchange=%s | routing_key=%s "
        "| bus_id=%s immatriculation=%s motif=%s",
        EXCHANGE_NOTIFICATION, ROUTING_BUS_BREAKDOWN, bus.IdBus, bus.immatriculation, motif,
    )
    message = {
        'event_type': 'BUS_BREAKDOWN',
        'bus_id': bus.IdBus,
        'immatriculation': bus.immatriculation,
        'agence_id': str(bus.Id_agence.id_agence),
        'motif': motif,
        'timestamp': timezone.now().isoformat(),
    }
    success = publish(EXCHANGE_NOTIFICATION, ROUTING_BUS_BREAKDOWN, message)
    if not success:
        logger.error(
            "[EVENT] Échec publication BUS_BREAKDOWN → notification-service | bus_id=%s",
            bus.IdBus,
        )
    return success


def publish_annonce_published(annonce):
    logger.info(
        "[EVENT] Envoi ANNONCE_PUBLISHED → destinataire=notification-service | exchange=%s | routing_key=%s "
        "| annonce_id=%s type=%s voyage_id=%s",
        EXCHANGE_NOTIFICATION, ROUTING_ANNONCE_PUBLISHED,
        annonce.id_annonce, annonce.type, annonce.Id_voyage.Id_voyage,
    )
    message = {
        'event_type': 'ANNONCE_PUBLISHED',
        'annonce_id': str(annonce.id_annonce),
        'type': annonce.type,
        'message': annonce.message,
        'voyage_id': str(annonce.Id_voyage.Id_voyage),
        'timestamp': timezone.now().isoformat(),
    }
    success = publish(EXCHANGE_NOTIFICATION, ROUTING_ANNONCE_PUBLISHED, message)
    if not success:
        logger.error(
            "[EVENT] Échec publication ANNONCE_PUBLISHED → notification-service | annonce_id=%s",
            annonce.id_annonce,
        )
    return success


# ==============================================================================
# PUBLICATIONS vers booking.exchange
# ==============================================================================

def publish_voyage_cancelled(voyage, motif):
    logger.info(
        "[EVENT] Envoi VOYAGE_CANCELLED → destinataire=booking-service | exchange=%s | routing_key=%s "
        "| voyage_id=%s motif=%s",
        EXCHANGE_BOOKING, ROUTING_VOYAGE_CANCELLED, voyage.Id_voyage, motif,
    )
    message = {
        'event_type': 'VOYAGE_CANCELLED',
        'voyage_id': str(voyage.Id_voyage),
        'agence_id': str(voyage.IdBus.Id_agence.id_agence),
        'trajet': str(voyage.Id_trajet),
        'date_depart': voyage.date_heure_depart.isoformat(),
        'motif': motif,
        'timestamp': timezone.now().isoformat(),
    }
    success = publish(EXCHANGE_BOOKING, ROUTING_VOYAGE_CANCELLED, message)
    if not success:
        logger.error(
            "[EVENT] Échec publication VOYAGE_CANCELLED → booking-service | voyage_id=%s",
            voyage.Id_voyage,
        )
    return success


# ==============================================================================
# PUBLICATIONS vers fleet.exchange — synchronisation booking
# ==============================================================================

def publish_agency_updated_for_booking(agence):
    logger.info(
        "[EVENT] Envoi AGENCY_UPDATED → destinataire=fleet-service (sync booking) | exchange=%s | routing_key=%s "
        "| agence_id=%s",
        EXCHANGE_FLEET, ROUTING_AGENCY_UPDATED_SYNC, agence.id_agence,
    )
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
    success = publish(EXCHANGE_FLEET, ROUTING_AGENCY_UPDATED_SYNC, message)
    if not success:
        logger.error(
            "[EVENT] Échec publication AGENCY_UPDATED → fleet (sync booking) | agence_id=%s",
            agence.id_agence,
        )
    return success


def publish_filiale_updated_for_booking(filiale):
    logger.info(
        "[EVENT] Envoi FILIALE_UPDATED → destinataire=fleet-service (sync booking) | exchange=%s | routing_key=%s "
        "| filiale_code=%s agence_id=%s",
        EXCHANGE_FLEET, ROUTING_FILIALE_UPDATED_SYNC, filiale.code, filiale.agence.id_agence,
    )
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
    success = publish(EXCHANGE_FLEET, ROUTING_FILIALE_UPDATED_SYNC, message)
    if not success:
        logger.error(
            "[EVENT] Échec publication FILIALE_UPDATED → fleet (sync booking) | filiale_code=%s",
            filiale.code,
        )
    return success


def publish_voyage_updated_for_booking(voyage):
    logger.info(
        "[EVENT] Envoi VOYAGE_UPDATED → destinataire=fleet-service (sync booking) | exchange=%s | routing_key=%s "
        "| voyage_id=%s status=%s",
        EXCHANGE_FLEET, ROUTING_VOYAGE_UPDATED_SYNC, voyage.Id_voyage, voyage.status,
    )
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
    success = publish(EXCHANGE_FLEET, ROUTING_VOYAGE_UPDATED_SYNC, message)
    if not success:
        logger.error(
            "[EVENT] Échec publication VOYAGE_UPDATED → fleet (sync booking) | voyage_id=%s",
            voyage.Id_voyage,
        )
    return success


def publish_bus_updated_for_booking(bus):
    logger.info(
        "[EVENT] Envoi BUS_UPDATED → destinataire=fleet-service (sync booking) | exchange=%s | routing_key=%s "
        "| bus_id=%s immatriculation=%s",
        EXCHANGE_FLEET, ROUTING_BUS_UPDATED_SYNC, bus.IdBus, bus.immatriculation,
    )
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
    success = publish(EXCHANGE_FLEET, ROUTING_BUS_UPDATED_SYNC, message)
    if not success:
        logger.error(
            "[EVENT] Échec publication BUS_UPDATED → fleet (sync booking) | bus_id=%s",
            bus.IdBus,
        )
    return success
