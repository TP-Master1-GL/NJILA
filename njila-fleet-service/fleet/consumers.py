import json
import logging
import threading
import pika
from django.conf import settings
from django.utils import timezone
from django.db import transaction

from .models import Agence, Chauffeur, Filiale, Voyage, StatusVoyage
from .rabbitmq import rabbitmq_client

logger = logging.getLogger(__name__)


class RabbitMQConsumer:
    """
    Consommateur RabbitMQ pour les événements inter-services.
    Écoute :
      - njila.subscribe.exchange  → expiration / renouvellement d'abonnement
      - njila.user.exchange       → événements utilisateur + synchronisation chauffeur
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
        exchanges = [
            ('njila.subscribe.exchange',    'topic',  True),
            ('njila.user.exchange',         'topic',  True),
            ('njila.booking.exchange',      'topic',  True),
            ('njila.fleet.exchange',        'topic',  True),
            ('njila.notification.exchange', 'topic',  True),
            ('njila.dead.letter.exchange',  'direct', True),
        ]
        for exchange, exchange_type, durable in exchanges:
            self.channel.exchange_declare(
                exchange=exchange,
                exchange_type=exchange_type,
                durable=durable
            )
        logger.info("[CONSUMER] Exchanges déclarés")

    def _declare_queues(self):
        """
        Déclarer les queues du fleet-service et effectuer les bindings.

        IMPORTANT : les arguments x-dead-letter-* et x-message-ttl de
        njila.fleet.chauffeur-sync.queue doivent correspondre EXACTEMENT
        à ceux déclarés dans RabbitMQConfig.java → durableQueue() :
          x-dead-letter-exchange    = "njila.dead.letter.exchange"
          x-dead-letter-routing-key = "dead.letter"
          x-message-ttl             = 86400000  (24 h)
        Toute divergence provoque AMQP 406 PRECONDITION_FAILED.
        """

        # ── Arguments partagés (miroir de durableQueue() Java) ────────────
        shared_dlx_args = {
            'x-dead-letter-exchange':    'njila.dead.letter.exchange',
            'x-dead-letter-routing-key': 'dead.letter',
            'x-message-ttl':             86400000,
        }

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

        # ── Queue abonnements ──────────────────────────────────────────────
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

        # ── Queue utilisateurs ─────────────────────────────────────────────
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

        # ── Queue réservations (booking-service) ───────────────────────────
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

        # ── [NOUVEAU] Queue synchronisation chauffeur depuis user-service ──
        # Doit utiliser les mêmes arguments que durableQueue() Java.
        self.channel.queue_declare(
            queue='njila.fleet.chauffeur-sync.queue',
            durable=True,
            arguments=shared_dlx_args          # ← miroir exact de Java
        )
        self.channel.queue_bind(
            exchange='njila.user.exchange',    # même exchange que côté Java
            queue='njila.fleet.chauffeur-sync.queue',
            routing_key='chauffeur.to.fleet'  # KEY_CHAUFFEUR_TO_FLEET
        )

        logger.info("[CONSUMER] Queues et bindings déclarés")

    # ------------------------------------------------------------------
    # Démarrage / arrêt
    # ------------------------------------------------------------------

    def start_consuming(self):
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
        # ── [NOUVEAU] ────────────────────────────────────────────────────
        self.channel.basic_consume(
            queue='njila.fleet.chauffeur-sync.queue',
            on_message_callback=self.on_chauffeur_sync_message,
            auto_ack=False
        )

        logger.info("[CONSUMER] Démarrage de la consommation RabbitMQ…")
        try:
            self.channel.start_consuming()
        except Exception as e:
            logger.error(f"[CONSUMER] Erreur lors de la consommation: {e}")
            self.is_consuming = False

    def stop_consuming(self):
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
        try:
            message    = json.loads(body)
            event_type = message.get('event_type')
            logger.info(f"[CONSUMER][USER] {method.routing_key} — {event_type}")
            ch.basic_ack(delivery_tag=method.delivery_tag)

        except Exception as e:
            logger.error(f"[CONSUMER][USER] Erreur: {e}")
            ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)

    def on_booking_message(self, ch, method, properties, body):
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

    # ── [NOUVEAU] Callback synchronisation chauffeur ───────────────────────
    def on_chauffeur_sync_message(self, ch, method, properties, body):
        """
        Reçoit l'événement chauffeur.to.fleet publié par user-service.
        Crée le Chauffeur dans la base fleet-service s'il n'existe pas déjà
        (idempotence sur user_id et email).
        """
        try:
            message = json.loads(body)
            logger.info(
                f"[CONSUMER][CHAUFFEUR_SYNC] Reçu | userId={message.get('userId')} "
                f"email={message.get('email')}"
            )
            self._handle_chauffeur_sync(message)
            ch.basic_ack(delivery_tag=method.delivery_tag)

        except Exception as e:
            logger.error(f"[CONSUMER][CHAUFFEUR_SYNC] Erreur: {e}")
            # requeue=False → le message part en dead-letter après échec
            ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)

    # ------------------------------------------------------------------
    # Handlers — abonnements
    # ------------------------------------------------------------------

    def _handle_subscription_expired(self, message):
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
        voyage_id = message.get('voyage_id')
        nb_places = int(message.get('nb_places', 1))
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

    # ------------------------------------------------------------------
    # [NOUVEAU] Handler — synchronisation chauffeur depuis user-service
    # ------------------------------------------------------------------

    def _handle_chauffeur_sync(self, message):
        """
        Crée un Chauffeur dans la base fleet-service à partir des données
        publiées par user-service.

        Idempotence :
          - Si un Chauffeur avec le même user_id (PK côté fleet) existe déjà,
            on ne fait rien (le message est peut-être un doublon).
          - Si l'email existe déjà avec un user_id différent, on log un warning
            et on laisse passer sans erreur pour ne pas bloquer la dead-letter.

        Champs attendus dans le payload :
          userId, email, name, surname, phone, adresse,
          agenceId, filialeId, numeroPermis, dateEmbauche (ISO, peut être vide)
        """
        user_id       = message.get('userId')
        email         = message.get('email', '').lower().strip()
        name          = message.get('name', '')
        surname       = message.get('surname', '')
        phone         = message.get('phone', '')
        adresse       = message.get('adresse', '')
        agence_id     = message.get('agenceId')
        filiale_id    = message.get('filialeId')
        numero_permis = message.get('numeroPermis', '')
        date_embauche_str = message.get('dateEmbauche', '')

        if not user_id or not email:
            logger.warning("[CONSUMER][CHAUFFEUR_SYNC] Payload incomplet (userId ou email manquant) — ignoré")
            return

        try:
            with transaction.atomic():

                # ── Idempotence : déjà synchronisé ? ──────────────────────
                if Chauffeur.objects.filter(id_chauffeur=user_id).exists():
                    logger.info(
                        f"[CONSUMER][CHAUFFEUR_SYNC] Chauffeur {user_id} déjà présent "
                        f"dans fleet-service — ignoré"
                    )
                    return

                # ── Collision email avec un autre chauffeur ? ──────────────
                if Chauffeur.objects.filter(email=email).exists():
                    logger.warning(
                        f"[CONSUMER][CHAUFFEUR_SYNC] Email '{email}' déjà utilisé par un autre "
                        f"chauffeur — synchronisation ignorée pour userId={user_id}"
                    )
                    return

                # ── Résolution de l'agence ─────────────────────────────────
                agence = None
                if agence_id:
                    agence = Agence.objects.filter(id_agence=agence_id).first()
                    if not agence:
                        logger.warning(
                            f"[CONSUMER][CHAUFFEUR_SYNC] Agence {agence_id} introuvable "
                            f"pour userId={user_id} — création sans agence"
                        )

                # ── Parsing date d'embauche ────────────────────────────────
                date_embauche = None
                if date_embauche_str:
                    from django.utils.dateparse import parse_datetime, parse_date
                    # Tenter d'abord un datetime, puis une date simple
                    parsed = parse_datetime(date_embauche_str)
                    if parsed:
                        date_embauche = parsed.date()
                    else:
                        date_embauche = parse_date(date_embauche_str)
                    if date_embauche is None:
                        logger.warning(
                            f"[CONSUMER][CHAUFFEUR_SYNC] Format dateEmbauche invalide "
                            f"'{date_embauche_str}' — utilisation de la date du jour"
                        )
                # Fallback : aujourd'hui (date_embauche est NOT NULL dans le modèle)
                if date_embauche is None:
                    from django.utils.timezone import now
                    date_embauche = now().date()

                # ── Création du Chauffeur ──────────────────────────────────
                chauffeur = Chauffeur(
                    id_chauffeur   = user_id,       # UUID synchronisé depuis user-service
                    numero_permis  = numero_permis,
                    name           = name,
                    surname        = surname,
                    email          = email,
                    phone          = phone,
                    Adresse        = adresse,
                    Id_agence      = agence,         # ForeignKey (peut être None)
                    est_disponible = True,
                    date_embauche  = date_embauche,
                )
                chauffeur.save()

                logger.info(
                    f"[CONSUMER][CHAUFFEUR_SYNC] Chauffeur créé dans fleet-service | "
                    f"userId={user_id} email={email} agenceId={agence_id} filialeId={filiale_id}"
                )

        except Exception as e:
            logger.error(f"[CONSUMER][CHAUFFEUR_SYNC] Erreur création chauffeur {user_id}: {e}")
            raise   # déclenche basic_nack → dead-letter


# ──────────────────────────────────────────────────────────────────────────────
# Instance globale + fonctions utilitaires
# ──────────────────────────────────────────────────────────────────────────────

consumer = RabbitMQConsumer()


def start_consumer():
    consumer.run_in_thread()


def stop_consumer():
    consumer.stop_consuming()
