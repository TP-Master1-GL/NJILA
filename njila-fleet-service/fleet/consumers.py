import json
import logging
import threading
import pika
from django.conf import settings
from django.utils import timezone
from django.db import transaction

from .models import Agence, Voyage, StatusVoyage
from .rabbitmq import rabbitmq_client

logger = logging.getLogger(__name__)


class RabbitMQConsumer:
    """
    Consommateur RabbitMQ pour les événements inter-services.
    Écoute :
      - njila.subscribe.exchange  → expiration / renouvellement d'abonnement
      - njila.user.exchange       → événements utilisateur
      - njila.booking.exchange    → booking.created / booking.confirmed / booking.depart
    """

    def __init__(self):
        self.host     = getattr(settings, 'RABBITMQ_HOST',     'njila-rabbitmq')
        self.port     = getattr(settings, 'RABBITMQ_PORT',     5672)
        self.user     = getattr(settings, 'RABBITMQ_USER',     'guest')
        self.password = getattr(settings, 'RABBITMQ_PASSWORD', 'guest')
        self.vhost    = getattr(settings, 'RABBITMQ_VHOST',    '/')

        self.connection      = None
        self.channel         = None
        self.is_consuming    = False
        self.consumer_thread = None

    # ------------------------------------------------------------------
    # Connexion
    # ------------------------------------------------------------------

    def connect(self):
        """Établir la connexion à RabbitMQ."""
        try:
            if self.connection and not self.connection.is_closed:
                return True

            credentials = pika.PlainCredentials(self.user, self.password)
            parameters  = pika.ConnectionParameters(
                host=self.host,
                port=self.port,
                virtual_host=self.vhost,
                credentials=credentials,
                heartbeat=600,
                blocked_connection_timeout=300
            )

            self.connection = pika.BlockingConnection(parameters)
            self.channel    = self.connection.channel()

            self._declare_exchanges()
            self._declare_queues()

            logger.info("[CONSUMER] Connexion RabbitMQ établie")
            return True

        except Exception as e:
            logger.error(f"[CONSUMER] Erreur connexion: {e}")
            return False

    # ------------------------------------------------------------------
    # Déclarations
    # ------------------------------------------------------------------

    def _declare_exchanges(self):
        """Déclarer tous les exchanges nécessaires."""
        exchanges = [
            ('njila.subscribe.exchange',   'topic',  True),
            ('njila.user.exchange',        'topic',  True),
            ('njila.booking.exchange',     'topic',  True),
            ('njila.fleet.exchange',       'topic',  True),
            ('njila.notification.exchange','topic',  True),
            ('njila.dead.letter.exchange', 'direct', True),
        ]
        for exchange, exchange_type, durable in exchanges:
            self.channel.exchange_declare(
                exchange=exchange,
                exchange_type=exchange_type,
                durable=durable
            )
        logger.info("[CONSUMER] Exchanges déclarés")

    def _declare_queues(self):
        """Déclarer les queues du fleet-service et effectuer les bindings."""

        dead_letter_args_sub     = {
            'x-dead-letter-exchange':    'njila.dead.letter.exchange',
            'x-dead-letter-routing-key': 'fleet.subscription.dead'
        }
        dead_letter_args_user    = {
            'x-dead-letter-exchange':    'njila.dead.letter.exchange',
            'x-dead-letter-routing-key': 'fleet.user.dead'
        }
        dead_letter_args_booking = {
            'x-dead-letter-exchange':    'njila.dead.letter.exchange',
            'x-dead-letter-routing-key': 'fleet.booking.dead'
        }

        # ── Queue abonnements ──────────────────────────────────────────
        self.channel.queue_declare(
            queue='njila.fleet.subscription.queue',
            durable=True,
            arguments=dead_letter_args_sub
        )
        self.channel.queue_bind(
            exchange='njila.subscribe.exchange',
            queue='njila.fleet.subscription.queue',
            routing_key='subscription.*'
        )

        # ── Queue utilisateurs ─────────────────────────────────────────
        self.channel.queue_declare(
            queue='njila.fleet.user.queue',
            durable=True,
            arguments=dead_letter_args_user
        )
        self.channel.queue_bind(
            exchange='njila.user.exchange',
            queue='njila.fleet.user.queue',
            routing_key='user.*'
        )

        # ── Queue réservations (booking-service) ───────────────────────
        # Écoute : booking.created, booking.confirmed, booking.depart
        self.channel.queue_declare(
            queue='njila.fleet.booking.queue',
            durable=True,
            arguments=dead_letter_args_booking
        )
        for routing_key in ('booking.created', 'booking.confirmed', 'booking.depart'):
            self.channel.queue_bind(
                exchange='njila.booking.exchange',
                queue='njila.fleet.booking.queue',
                routing_key=routing_key
            )

        logger.info("[CONSUMER] Queues et bindings déclarés")

    # ------------------------------------------------------------------
    # Démarrage / arrêt
    # ------------------------------------------------------------------

    def start_consuming(self):
        """Démarrer la consommation des messages."""
        if self.is_consuming:
            logger.warning("[CONSUMER] Consommation déjà active")
            return

        if not self.connect():
            logger.error("[CONSUMER] Impossible de démarrer: connexion échouée")
            return

        self.is_consuming = True
        self.channel.basic_qos(prefetch_count=1)

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

        logger.info("[CONSUMER] Démarrage de la consommation RabbitMQ…")
        try:
            self.channel.start_consuming()
        except Exception as e:
            logger.error(f"[CONSUMER] Erreur lors de la consommation: {e}")
            self.is_consuming = False

    def stop_consuming(self):
        """Arrêter proprement la consommation."""
        if not self.is_consuming:
            return
        try:
            self.channel.stop_consuming()
            self.is_consuming = False
            logger.info("[CONSUMER] Consommation arrêtée")
        except Exception as e:
            logger.error(f"[CONSUMER] Erreur arrêt: {e}")
        if self.connection and not self.connection.is_closed:
            self.connection.close()

    def run_in_thread(self):
        """Exécuter le consommateur dans un thread daemon."""
        def worker():
            try:
                self.start_consuming()
            except Exception as e:
                logger.error(f"[CONSUMER] Erreur thread: {e}")
                self.is_consuming = False

        self.consumer_thread = threading.Thread(target=worker, daemon=True)
        self.consumer_thread.start()
        logger.info("[CONSUMER] Thread démarré")

    # ------------------------------------------------------------------
    # Callbacks principaux
    # ------------------------------------------------------------------

    def on_subscription_message(self, ch, method, properties, body):
        """
        Messages du subscribe-service.
        Routing keys : subscription.expired | subscription.renewed
        """
        try:
            message    = json.loads(body)
            event_type = message.get('event_type')
            logger.info(f"[CONSUMER][SUBSCRIPTION] {method.routing_key} — {event_type}")

            if method.routing_key == 'subscription.expired':
                self._handle_subscription_expired(message)
            elif method.routing_key == 'subscription.renewed':
                self._handle_subscription_renewed(message)
            else:
                logger.warning(f"[CONSUMER][SUBSCRIPTION] Routing key non gérée: {method.routing_key}")

            ch.basic_ack(delivery_tag=method.delivery_tag)

        except Exception as e:
            logger.error(f"[CONSUMER][SUBSCRIPTION] Erreur: {e}")
            ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)

    def on_user_message(self, ch, method, properties, body):
        """
        Messages du user-service.
        Routing keys : user.created | user.updated | user.deleted
        """
        try:
            message    = json.loads(body)
            event_type = message.get('event_type')
            logger.info(f"[CONSUMER][USER] {method.routing_key} — {event_type}")
            # Extensible : synchronisation staff, mise à jour profil chauffeur, etc.
            ch.basic_ack(delivery_tag=method.delivery_tag)

        except Exception as e:
            logger.error(f"[CONSUMER][USER] Erreur: {e}")
            ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)

    def on_booking_message(self, ch, method, properties, body):
        """
        Messages du booking-service.
        Routing keys :
          - booking.created   → décrémenter les places disponibles (soft-lock)
          - booking.confirmed → confirmer l'occupation définitive du siège
          - booking.depart    → passer le voyage en EN_COURS
        """
        try:
            message    = json.loads(body)
            event_type = message.get('event_type')
            logger.info(f"[CONSUMER][BOOKING] {method.routing_key} — {event_type}")

            if method.routing_key == 'booking.created':
                self._handle_booking_created(message)
            elif method.routing_key == 'booking.confirmed':
                self._handle_booking_confirmed(message)
            elif method.routing_key == 'booking.depart':
                self._handle_booking_depart(message)
            else:
                logger.warning(f"[CONSUMER][BOOKING] Routing key non gérée: {method.routing_key}")

            ch.basic_ack(delivery_tag=method.delivery_tag)

        except Exception as e:
            logger.error(f"[CONSUMER][BOOKING] Erreur: {e}")
            ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)

    # ------------------------------------------------------------------
    # Handlers — abonnements
    # ------------------------------------------------------------------

    def _handle_subscription_expired(self, message):
        """Passer l'agence en statut 'expiree' quand son abonnement expire."""
        agence_id  = message.get('agence_id')
        agence_nom = message.get('agence_nom')

        logger.warning(f"[CONSUMER] Abonnement expiré — agence: {agence_nom} ({agence_id})")

        try:
            with transaction.atomic():
                agence = Agence.objects.filter(id_agence=agence_id).first()
                if agence:
                    agence.statut_global = 'expiree'
                    agence.save(update_fields=['statut_global'])
                    logger.info(f"[CONSUMER] Agence '{agence.name}' marquée comme expirée")
                else:
                    logger.warning(f"[CONSUMER] Agence {agence_id} introuvable")
        except Exception as e:
            logger.error(f"[CONSUMER] Erreur mise à jour agence {agence_id}: {e}")
            raise

    def _handle_subscription_renewed(self, message):
        """Réactiver l'agence quand son abonnement est renouvelé."""
        agence_id  = message.get('agence_id')
        agence_nom = message.get('agence_nom')

        logger.info(f"[CONSUMER] Abonnement renouvelé — agence: {agence_nom} ({agence_id})")

        try:
            with transaction.atomic():
                agence = Agence.objects.filter(id_agence=agence_id).first()
                if agence:
                    agence.statut_global = 'active'
                    agence.save(update_fields=['statut_global'])
                    logger.info(f"[CONSUMER] Agence '{agence.name}' réactivée")
                else:
                    logger.warning(f"[CONSUMER] Agence {agence_id} introuvable")
        except Exception as e:
            logger.error(f"[CONSUMER] Erreur mise à jour agence {agence_id}: {e}")
            raise

    # ------------------------------------------------------------------
    # Handlers — booking
    # ------------------------------------------------------------------

    def _handle_booking_created(self, message):
        """
        booking.created → soft-lock : décrémenter les places disponibles
        immédiatement pour éviter la sur-réservation pendant que le paiement
        est en cours.
        """
        voyage_id      = message.get('voyage_id')
        nb_places      = int(message.get('nb_places', 1))

        if not voyage_id:
            logger.warning("[CONSUMER][BOOKING] booking.created sans voyage_id — ignoré")
            return

        try:
            with transaction.atomic():
                voyage = Voyage.objects.select_for_update().filter(Id_voyage=voyage_id).first()
                if not voyage:
                    logger.warning(f"[CONSUMER][BOOKING] Voyage {voyage_id} introuvable")
                    return

                if voyage.places_disponibles >= nb_places:
                    voyage.places_disponibles -= nb_places
                    voyage.save(update_fields=['places_disponibles'])
                    logger.info(
                        f"[CONSUMER][BOOKING] Soft-lock {nb_places} place(s) "
                        f"→ reste {voyage.places_disponibles} (voyage {voyage_id})"
                    )
                else:
                    logger.warning(
                        f"[CONSUMER][BOOKING] Plus assez de places sur voyage {voyage_id} "
                        f"(dispo={voyage.places_disponibles}, demandé={nb_places})"
                    )
        except Exception as e:
            logger.error(f"[CONSUMER][BOOKING] Erreur booking.created: {e}")
            raise

    def _handle_booking_confirmed(self, message):
        """
        booking.confirmed → la réservation est confirmée (paiement OK).
        On incrémente places_total_reservees pour le suivi définitif.
        """
        voyage_id = message.get('voyage_id')
        nb_places = int(message.get('nb_places', 1))

        if not voyage_id:
            logger.warning("[CONSUMER][BOOKING] booking.confirmed sans voyage_id — ignoré")
            return

        try:
            with transaction.atomic():
                voyage = Voyage.objects.select_for_update().filter(Id_voyage=voyage_id).first()
                if not voyage:
                    logger.warning(f"[CONSUMER][BOOKING] Voyage {voyage_id} introuvable")
                    return

                voyage.places_total_reservees = (getattr(voyage, 'places_total_reservees', 0) or 0) + nb_places
                voyage.save(update_fields=['places_total_reservees'])
                logger.info(
                    f"[CONSUMER][BOOKING] Réservation confirmée — {nb_places} place(s) "
                    f"(total réservé: {voyage.places_total_reservees}, voyage {voyage_id})"
                )
        except Exception as e:
            logger.error(f"[CONSUMER][BOOKING] Erreur booking.confirmed: {e}")
            raise

    def _handle_booking_depart(self, message):
        """
        booking.depart → le booking signale que le voyage a physiquement démarré.
        On s'assure que le statut est EN_COURS dans le fleet-service.
        """
        voyage_id = message.get('voyage_id')

        if not voyage_id:
            logger.warning("[CONSUMER][BOOKING] booking.depart sans voyage_id — ignoré")
            return

        try:
            with transaction.atomic():
                voyage = Voyage.objects.select_for_update().filter(Id_voyage=voyage_id).first()
                if not voyage:
                    logger.warning(f"[CONSUMER][BOOKING] Voyage {voyage_id} introuvable")
                    return

                if voyage.status != StatusVoyage.EN_COURS:
                    voyage.status = StatusVoyage.EN_COURS
                    voyage.save(update_fields=['status'])
                    logger.info(f"[CONSUMER][BOOKING] Voyage {voyage_id} passé EN_COURS via booking.depart")
                else:
                    logger.info(f"[CONSUMER][BOOKING] Voyage {voyage_id} déjà EN_COURS — rien à faire")
        except Exception as e:
            logger.error(f"[CONSUMER][BOOKING] Erreur booking.depart: {e}")
            raise


# ──────────────────────────────────────────────────────────────────────────────
# Instance globale + fonctions utilitaires
# ──────────────────────────────────────────────────────────────────────────────

consumer = RabbitMQConsumer()


def start_consumer():
    """Démarrer le consommateur dans un thread daemon."""
    consumer.run_in_thread()


def stop_consumer():
    """Arrêter proprement le consommateur."""
    consumer.stop_consuming()