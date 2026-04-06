import json
import logging
import threading
import time
import pika
from django.conf import settings
from django.utils import timezone
from django.db import transaction

from .models import Agence, Filiale
from .rabbitmq import rabbitmq_client

logger = logging.getLogger(__name__)


class RabbitMQConsumer:
    """
    Consommateur RabbitMQ pour les événements inter-services
    """
    
    def __init__(self):
        self.host = getattr(settings, 'RABBITMQ_HOST', 'localhost')
        self.port = getattr(settings, 'RABBITMQ_PORT', 5672)
        self.user = getattr(settings, 'RABBITMQ_USER', 'guest')
        self.password = getattr(settings, 'RABBITMQ_PASSWORD', 'guest')
        self.vhost = getattr(settings, 'RABBITMQ_VHOST', '/')
        
        self.connection = None
        self.channel = None
        self.is_consuming = False
        self.consumer_thread = None
    
    def connect(self):
        """Établir la connexion à RabbitMQ"""
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
                blocked_connection_timeout=300
            )
            
            self.connection = pika.BlockingConnection(parameters)
            self.channel = self.connection.channel()
            
            # Déclarer les exchanges (au cas où ils n'existent pas)
            self._declare_exchanges()
            
            # Déclarer les queues
            self._declare_queues()
            
            logger.info("Consumer RabbitMQ connecté avec succès")
            return True
            
        except Exception as e:
            logger.error(f"Erreur connexion consumer RabbitMQ: {e}")
            return False
    
    def _declare_exchanges(self):
        """Déclarer les exchanges nécessaires"""
        exchanges = [
            ('njila.subscribe.exchange', 'topic', True),
            ('njila.user.exchange', 'topic', True),
            ('njila.booking.exchange', 'topic', True),
            ('njila.dead.letter.exchange', 'direct', True),
        ]
        
        for exchange, exchange_type, durable in exchanges:
            self.channel.exchange_declare(
                exchange=exchange,
                exchange_type=exchange_type,
                durable=durable
            )
            logger.info(f"Exchange déclaré pour consumer: {exchange}")
    
    def _declare_queues(self):
        """Déclarer les queues pour le fleet-service"""
        
        # Queue pour les événements d'abonnement (subscribe-service)
        self.channel.queue_declare(
            queue='njila.fleet.subscription.queue',
            durable=True,
            arguments={
                'x-dead-letter-exchange': 'njila.dead.letter.exchange',
                'x-dead-letter-routing-key': 'fleet.subscription.dead'
            }
        )
        
        # Queue pour les événements utilisateur (user-service)
        self.channel.queue_declare(
            queue='njila.fleet.user.queue',
            durable=True,
            arguments={
                'x-dead-letter-exchange': 'njila.dead.letter.exchange',
                'x-dead-letter-routing-key': 'fleet.user.dead'
            }
        )
        
        # Queue pour les événements de réservation (booking-service)
        self.channel.queue_declare(
            queue='njila.fleet.booking.queue',
            durable=True,
            arguments={
                'x-dead-letter-exchange': 'njila.dead.letter.exchange',
                'x-dead-letter-routing-key': 'fleet.booking.dead'
            }
        )
        
        # Bind des queues aux exchanges
        # Abonnements
        self.channel.queue_bind(
            exchange='njila.subscribe.exchange',
            queue='njila.fleet.subscription.queue',
            routing_key='subscription.*'
        )
        
        # Utilisateurs
        self.channel.queue_bind(
            exchange='njila.user.exchange',
            queue='njila.fleet.user.queue',
            routing_key='user.*'
        )
        
        # Réservations
        self.channel.queue_bind(
            exchange='njila.booking.exchange',
            queue='njila.fleet.booking.queue',
            routing_key='reservation.*'
        )
        
        logger.info("Queues déclarées pour le fleet-service")
    
    def start_consuming(self):
        """Démarrer la consommation des messages"""
        if self.is_consuming:
            logger.warning("La consommation est déjà active")
            return
        
        if not self.connect():
            logger.error("Impossible de démarrer la consommation: connexion échouée")
            return
        
        self.is_consuming = True
        
        # Configurer les callbacks
        self.channel.basic_consume(
            queue='njila.fleet.subscription.queue',
            on_message_callback=self.on_subscription_message,
            auto_ack=False
        )
        
        self.channel.basic_consume(
            queue='njila.fleet.user.queue',
            on_message_callback=self.on_user_message,
            auto_ack=False
        )
        
        self.channel.basic_consume(
            queue='njila.fleet.booking.queue',
            on_message_callback=self.on_booking_message,
            auto_ack=False
        )
        
        logger.info("Démarrage de la consommation RabbitMQ...")
        
        try:
            self.channel.start_consuming()
        except Exception as e:
            logger.error(f"Erreur lors de la consommation: {e}")
            self.is_consuming = False
    
    def on_subscription_message(self, ch, method, properties, body):
        """
        Traitement des messages d'abonnement (subscribe-service)
        Routing keys: subscription.expired, subscription.renewed
        """
        try:
            message = json.loads(body)
            event_type = message.get('event_type')
            logger.info(f"Message d'abonnement reçu: {method.routing_key} - {event_type}")
            
            if method.routing_key == 'subscription.expired':
                self._handle_subscription_expired(message)
            elif method.routing_key == 'subscription.renewed':
                self._handle_subscription_renewed(message)
            else:
                logger.warning(f"Routing key non gérée: {method.routing_key}")
            
            ch.basic_ack(delivery_tag=method.delivery_tag)
            
        except Exception as e:
            logger.error(f"Erreur traitement message abonnement: {e}")
            # Rejeter le message pour qu'il soit retraité ou envoyé en DLQ
            ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
    
    def on_user_message(self, ch, method, properties, body):
        """
        Traitement des messages utilisateur (user-service)
        Routing keys: user.created, user.updated, user.deleted
        """
        try:
            message = json.loads(body)
            event_type = message.get('event_type')
            logger.info(f"Message utilisateur reçu: {method.routing_key} - {event_type}")
            
            # Pour l'instant, on loggue seulement. Plus tard, on pourra:
            # - Mettre à jour des informations de chauffeur/guichetier
            # - Synchroniser les données utilisateur
            
            ch.basic_ack(delivery_tag=method.delivery_tag)
            
        except Exception as e:
            logger.error(f"Erreur traitement message utilisateur: {e}")
            ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
    
    def on_booking_message(self, ch, method, properties, body):
        """
        Traitement des messages de réservation (booking-service)
        Routing keys: reservation.created, reservation.cancelled
        """
        try:
            message = json.loads(body)
            event_type = message.get('event_type')
            logger.info(f"Message réservation reçu: {method.routing_key} - {event_type}")
            
            # Pour l'instant, on loggue seulement. Plus tard, on pourra:
            # - Mettre à jour les places disponibles dans Redis
            # - Synchroniser les réservations
            
            ch.basic_ack(delivery_tag=method.delivery_tag)
            
        except Exception as e:
            logger.error(f"Erreur traitement message réservation: {e}")
            ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
    
    def _handle_subscription_expired(self, message):
        """
        Gérer l'expiration d'abonnement d'une agence
        """
        agence_id = message.get('agence_id')
        agence_nom = message.get('agence_nom')
        expires_at = message.get('expires_at')
        
        logger.warning(f"⚠️ Abonnement expiré pour l'agence: {agence_nom} (ID: {agence_id})")
        
        # Mettre à jour le statut de l'agence dans notre base
        try:
            with transaction.atomic():
                agence = Agence.objects.filter(id_agence=agence_id).first()
                if agence:
                    agence.statut_global = 'expiree'
                    agence.save()
                    logger.info(f"Agence {agence.name} marquée comme expirée")
                else:
                    logger.warning(f"Agence {agence_id} non trouvée dans la base")
        except Exception as e:
            logger.error(f"Erreur mise à jour agence {agence_id}: {e}")
    
    def _handle_subscription_renewed(self, message):
        """
        Gérer le renouvellement d'abonnement d'une agence
        """
        agence_id = message.get('agence_id')
        agence_nom = message.get('agence_nom')
        new_expires_at = message.get('new_expires_at')
        
        logger.info(f"✅ Abonnement renouvelé pour l'agence: {agence_nom} (ID: {agence_id})")
        
        # Mettre à jour le statut de l'agence dans notre base
        try:
            with transaction.atomic():
                agence = Agence.objects.filter(id_agence=agence_id).first()
                if agence:
                    agence.statut_global = 'active'
                    agence.save()
                    logger.info(f"Agence {agence.name} réactivée")
                else:
                    logger.warning(f"Agence {agence_id} non trouvée dans la base")
        except Exception as e:
            logger.error(f"Erreur mise à jour agence {agence_id}: {e}")
    
    def stop_consuming(self):
        """Arrêter la consommation"""
        if not self.is_consuming:
            return
        
        try:
            self.channel.stop_consuming()
            self.is_consuming = False
            logger.info("Consommation RabbitMQ arrêtée")
        except Exception as e:
            logger.error(f"Erreur arrêt consommation: {e}")
        
        if self.connection and not self.connection.is_closed:
            self.connection.close()
    
    def run_in_thread(self):
        """Exécuter le consommateur dans un thread séparé"""
        def worker():
            try:
                self.start_consuming()
            except Exception as e:
                logger.error(f"Erreur dans le thread consumer: {e}")
                self.is_consuming = False
        
        self.consumer_thread = threading.Thread(target=worker, daemon=True)
        self.consumer_thread.start()
        logger.info("Consumer RabbitMQ démarré dans un thread séparé")


# Instance globale du consommateur
consumer = RabbitMQConsumer()


def start_consumer():
    """Démarrer le consommateur"""
    consumer.run_in_thread()


def stop_consumer():
    """Arrêter le consommateur"""
    consumer.stop_consuming()