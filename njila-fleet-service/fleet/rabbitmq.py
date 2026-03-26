import pika
import json
import logging
from django.conf import settings
from django.utils import timezone
import os

logger = logging.getLogger(__name__)

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
    
    def connect(self):
        try:
            if not self.connection or self.connection.is_closed:
                credentials = pika.PlainCredentials(self.user, self.password)
                parameters = pika.ConnectionParameters(
                    host=self.host,
                    port=self.port,
                    virtual_host=self.vhost,
                    credentials=credentials,
                    heartbeat=600,
                    blocked_connection_timeout=300
                )
                self.connection = pika.BlockingConnection(parameters)
                self.channel = self.connection.channel()
                
                self.channel.exchange_declare(
                    exchange='njila.fleet.exchange',
                    exchange_type='topic',
                    durable=True
                )
                
                self.channel.exchange_declare(
                    exchange='njila.dead.letter.exchange',
                    exchange_type='direct',
                    durable=True
                )
                
                logger.info("RabbitMQ connecté avec succès")
            return True
        except Exception as e:
            logger.error(f"Erreur connexion RabbitMQ: {e}")
            return False
    
    def publish(self, routing_key, message):
        try:
            if not self.connect():
                logger.warning("Impossible de se connecter à RabbitMQ, message non publié")
                return False
            
            self.channel.basic_publish(
                exchange='njila.fleet.exchange',
                routing_key=routing_key,
                body=json.dumps(message, default=str),
                properties=pika.BasicProperties(
                    delivery_mode=2,
                    content_type='application/json',
                    timestamp=int(timezone.now().timestamp())
                )
            )
            logger.info(f"Message publié: {routing_key}")
            return True
        except Exception as e:
            logger.error(f"Erreur publication RabbitMQ: {e}")
            return False
    
    def close(self):
        if self.connection and not self.connection.is_closed:
            self.connection.close()
            logger.info("Connexion RabbitMQ fermée")

rabbitmq_client = RabbitMQClient()


# ============ FONCTIONS DE PUBLICATION ============

def publish_agence_created(agence):
    """Publier la création d'une agence"""
    try:
        message = {
            'event_type': 'AGENCE_CREATED',
            'agence_id': str(agence.id_agence),
            'nom': agence.name,
            'adresse': agence.adresse,
            'telephone': agence.telephone,
            'email_officiel': agence.email_officiel,
            'timestamp': timezone.now().isoformat()
        }
        return rabbitmq_client.publish('agence.created', message)
    except Exception as e:
        logger.error(f"Erreur publication agence.created: {e}")
        return False

def publish_agence_updated(agence):
    """Publier la mise à jour d'une agence"""
    try:
        message = {
            'event_type': 'AGENCE_UPDATED',
            'agence_id': str(agence.id_agence),
            'nom': agence.name,
            'telephone': agence.telephone,
            'email_officiel': agence.email_officiel,
            'statut_global': agence.statut_global,
            'timestamp': timezone.now().isoformat()
        }
        return rabbitmq_client.publish('agence.updated', message)
    except Exception as e:
        logger.error(f"Erreur publication agence.updated: {e}")
        return False

def publish_agence_subscription_request(agence):
    """Demande d'abonnement pour une agence"""
    try:
        message = {
            'event_type': 'SUBSCRIPTION_REQUEST',
            'agence_id': str(agence.id_agence),
            'agence_nom': agence.name,
            'contact_email': agence.email_officiel,
            'contact_telephone': agence.telephone,
            'adresse': agence.adresse,
            'timestamp': timezone.now().isoformat()
        }
        return rabbitmq_client.publish('subscription.request', message)
    except Exception as e:
        logger.error(f"Erreur publication subscription.request: {e}")
        return False

def publish_filiale_created(filiale):
    """Publier la création d'une filiale"""
    try:
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
        return rabbitmq_client.publish('filiale.created', message)
    except Exception as e:
        logger.error(f"Erreur publication filiale.created: {e}")
        return False

def publish_filiale_updated(filiale):
    """Publier la mise à jour d'une filiale"""
    try:
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
        return rabbitmq_client.publish('filiale.updated', message)
    except Exception as e:
        logger.error(f"Erreur publication filiale.updated: {e}")
        return False

def publish_voyage_cancelled(voyage, motif):
    """Publier un événement d'annulation de voyage"""
    try:
        message = {
            'event_type': 'VOYAGE_CANCELLED',
            'voyage_id': str(voyage.Id_voyage),
            'agence_id': str(voyage.IdBus.Id_agence.id_agence),
            'trajet': str(voyage.Id_trajet),
            'date_depart': voyage.date_heure_depart.isoformat(),
            'motif': motif,
            'timestamp': timezone.now().isoformat()
        }
        return rabbitmq_client.publish('voyage.cancelled', message)
    except Exception as e:
        logger.error(f"Erreur publication voyage.cancelled: {e}")
        return False

def publish_voyage_delayed(voyage, nouveau_depart):
    """Publier un événement de retard de voyage"""
    try:
        message = {
            'event_type': 'VOYAGE_DELAYED',
            'voyage_id': str(voyage.Id_voyage),
            'agence_id': str(voyage.IdBus.Id_agence.id_agence),
            'trajet': str(voyage.Id_trajet),
            'date_depart_original': voyage.date_heure_depart.isoformat(),
            'date_depart_nouveau': nouveau_depart.isoformat(),
            'timestamp': timezone.now().isoformat()
        }
        return rabbitmq_client.publish('voyage.delayed', message)
    except Exception as e:
        logger.error(f"Erreur publication voyage.delayed: {e}")
        return False

def publish_voyage_departed(voyage):
    """Publier un événement de départ de voyage"""
    try:
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
        return rabbitmq_client.publish('voyage.departed', message)
    except Exception as e:
        logger.error(f"Erreur publication voyage.departed: {e}")
        return False

def publish_bus_status_changed(bus, ancien_status, nouveau_status, raison):
    """Publier un changement d'état de bus"""
    try:
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
        return rabbitmq_client.publish('bus.status.changed', message)
    except Exception as e:
        logger.error(f"Erreur publication bus.status.changed: {e}")
        return False

def publish_bus_breakdown(bus, motif):
    """Publier un événement de panne de bus"""
    try:
        message = {
            'event_type': 'BUS_BREAKDOWN',
            'bus_id': bus.IdBus,
            'immatriculation': bus.immatriculation,
            'agence_id': str(bus.Id_agence.id_agence),
            'motif': motif,
            'timestamp': timezone.now().isoformat()
        }
        return rabbitmq_client.publish('bus.breakdown', message)
    except Exception as e:
        logger.error(f"Erreur publication bus.breakdown: {e}")
        return False
    
def publish_staff_created(user_id, role, filiale_id=None, agence_id=None):
    """
    Publier la création d'un staff (guichetier/chauffeur) pour auth-service
    """
    try:
        message = {
            'event_type': 'STAFF_CREATED',
            'user_id': str(user_id),
            'role': role,
            'filiale_id': str(filiale_id) if filiale_id else None,
            'agence_id': str(agence_id) if agence_id else None,
            'timestamp': timezone.now().isoformat()
        }
        return rabbitmq_client.publish('staff.created', message)
    except Exception as e:
        logger.error(f"Erreur publication staff.created: {e}")
        return False


def publish_annonce_published(annonce):
    """
    Publier une annonce pour notification-service
    """
    try:
        message = {
            'event_type': 'ANNONCE_PUBLISHED',
            'annonce_id': str(annonce.id_annonce),
            'type': annonce.type,
            'message': annonce.message,
            'voyage_id': str(annonce.Id_voyage.Id_voyage),
            'timestamp': timezone.now().isoformat()
        }
        return rabbitmq_client.publish('annonce.published', message)
    except Exception as e:
        logger.error(f"Erreur publication annonce.published: {e}")
        return False