"""
test_consumers.py — Tests unitaires du RabbitMQConsumer (consumers.py).

Couverture :
  - Handlers abonnements  : _handle_subscription_expired / _handle_subscription_renewed
  - Handlers booking      : _handle_booking_created / _handle_booking_confirmed / _handle_booking_depart
  - Handler chauffeur     : _handle_chauffeur_sync (idempotence, création, collision email)
  - Callbacks principaux  : on_*_message (ack / nack selon résultat)
  - start/stop consuming, run_in_thread
"""

import json
import uuid
from decimal import Decimal
from unittest.mock import MagicMock, patch, call
from django.test import TestCase
from django.utils import timezone

from fleet.models import (
    Agence, Filiale, Bus, Chauffeur, Voyage, Trajet,
    StatusVoyage, StatusBus, StatutGlobalAgence, TypeVoyage,
)


# ─────────────────────────────────────────────────────────────────────────────
# Helpers de fixtures DB
# ─────────────────────────────────────────────────────────────────────────────

def _make_agence(**kw):
    return Agence.objects.create(
        name=kw.get('name', 'Express Voyages'),
        adresse=kw.get('adresse', 'Douala'),
        telephone=kw.get('telephone', '699000001'),
        email_officiel=kw.get('email_officiel', 'contact@express.cm'),
        statut_global=kw.get('statut_global', StatutGlobalAgence.ACTIVE),
    )


def _make_filiales(agence):
    f1 = Filiale.objects.create(
        agence=agence, nom='Filiale Douala', code='DLA',
        ville='Douala', adresse='Douala', telephone='699000002',
        email='dlo@exp.cm', est_active=True,
    )
    f2 = Filiale.objects.create(
        agence=agence, nom='Filiale Yaoundé', code='YDE',
        ville='Yaoundé', adresse='Yaoundé', telephone='699000003',
        email='yde@exp.cm', est_active=True,
    )
    return f1, f2


def _make_voyage(agence, filiales):
    bus = Bus.objects.create(
        modele='Toyota', immatriculation='LT001AB',
        capacite=30, etat=StatusBus.DISPONIBLE, Id_agence=agence,
    )
    trajet = Trajet.objects.create(
        filiale_depart=filiales[0], filiale_arrive=filiales[1], distance=200,
    )
    now = timezone.now()
    return Voyage.objects.create(
        date_heure_depart=now + timezone.timedelta(hours=2),
        date_heure_arrive_prevue=now + timezone.timedelta(hours=7),
        prix=Decimal('5000.00'),
        type_voyage=TypeVoyage.STANDARD,
        status=StatusVoyage.PROGRAMME,
        places_disponibles=30,
        IdBus=bus,
        Id_trajet=trajet,
    )


def _make_channel_method(routing_key, delivery_tag=1):
    ch     = MagicMock()
    method = MagicMock()
    method.routing_key  = routing_key
    method.delivery_tag = delivery_tag
    props  = MagicMock()
    return ch, method, props


# ─────────────────────────────────────────────────────────────────────────────
# Instanciation du consumer (sans démarrer la connexion RabbitMQ)
# ─────────────────────────────────────────────────────────────────────────────

def _make_consumer():
    from fleet.consumers import RabbitMQConsumer
    c = RabbitMQConsumer.__new__(RabbitMQConsumer)
    c.host     = 'localhost'
    c.port     = 5672
    c.user     = 'guest'
    c.password = 'guest'
    c.vhost    = '/'
    c.connection      = None
    c.channel         = None
    c.is_consuming    = False
    c.consumer_thread = None
    return c


# ─────────────────────────────────────────────────────────────────────────────
# Handlers abonnements
# ─────────────────────────────────────────────────────────────────────────────

class HandleSubscriptionTest(TestCase):

    def setUp(self):
        self.consumer = _make_consumer()
        self.agence   = _make_agence()

    # ── expired ──────────────────────────────────────────────────────────────

    def test_subscription_expired_marque_agence_expiree(self):
        message = {
            'agence_id':  str(self.agence.id_agence),
            'agence_nom': self.agence.name,
        }
        self.consumer._handle_subscription_expired(message)
        self.agence.refresh_from_db()
        self.assertEqual(self.agence.statut_global, 'expiree')

    def test_subscription_expired_agence_introuvable(self):
        """Doit logger un warning sans lever d'exception."""
        message = {'agence_id': str(uuid.uuid4()), 'agence_nom': 'Inconnue'}
        # Ne doit pas lever d'exception
        self.consumer._handle_subscription_expired(message)

    # ── renewed ──────────────────────────────────────────────────────────────

    def test_subscription_renewed_marque_agence_active(self):
        self.agence.statut_global = 'expiree'
        self.agence.save()
        message = {
            'agence_id':  str(self.agence.id_agence),
            'agence_nom': self.agence.name,
        }
        self.consumer._handle_subscription_renewed(message)
        self.agence.refresh_from_db()
        self.assertEqual(self.agence.statut_global, 'active')

    def test_subscription_renewed_agence_introuvable(self):
        message = {'agence_id': str(uuid.uuid4()), 'agence_nom': 'Inconnue'}
        self.consumer._handle_subscription_renewed(message)

    # ── callbacks on_subscription_message ────────────────────────────────────

    def test_on_subscription_expired_ack(self):
        ch, method, props = _make_channel_method('subscription.expired')
        body = json.dumps({
            'event_type': 'SUBSCRIPTION_EXPIRED',
            'agence_id':  str(self.agence.id_agence),
            'agence_nom': self.agence.name,
        }).encode()
        self.consumer.on_subscription_message(ch, method, props, body)
        ch.basic_ack.assert_called_once_with(delivery_tag=method.delivery_tag)

    def test_on_subscription_renewed_ack(self):
        ch, method, props = _make_channel_method('subscription.renewed')
        body = json.dumps({
            'event_type': 'SUBSCRIPTION_RENEWED',
            'agence_id':  str(self.agence.id_agence),
            'agence_nom': self.agence.name,
        }).encode()
        self.consumer.on_subscription_message(ch, method, props, body)
        ch.basic_ack.assert_called_once()

    def test_on_subscription_json_invalide_nack(self):
        ch, method, props = _make_channel_method('subscription.expired')
        self.consumer.on_subscription_message(ch, method, props, b'NOT_JSON')
        ch.basic_nack.assert_called_once_with(
            delivery_tag=method.delivery_tag, requeue=False
        )

    def test_on_subscription_routing_key_inconnue_ack(self):
        ch, method, props = _make_channel_method('subscription.unknown')
        body = json.dumps({'event_type': 'UNKNOWN'}).encode()
        self.consumer.on_subscription_message(ch, method, props, body)
        ch.basic_ack.assert_called_once()


# ─────────────────────────────────────────────────────────────────────────────
# Handlers booking
# ─────────────────────────────────────────────────────────────────────────────

class HandleBookingTest(TestCase):

    def setUp(self):
        self.consumer = _make_consumer()
        self.agence   = _make_agence()
        filiales      = _make_filiales(self.agence)
        self.voyage   = _make_voyage(self.agence, filiales)

    # ── booking.created ───────────────────────────────────────────────────────

    def test_booking_created_decrement_places(self):
        places_avant = self.voyage.places_disponibles
        message = {
            'event_type': 'BOOKING_CREATED',
            'voyage_id':  str(self.voyage.Id_voyage),
            'nb_places':  2,
        }
        self.consumer._handle_booking_created(message)
        self.voyage.refresh_from_db()
        self.assertEqual(self.voyage.places_disponibles, places_avant - 2)

    def test_booking_created_pas_assez_places(self):
        """Si nb_places > places_disponibles, on ne décrément pas."""
        self.voyage.places_disponibles = 1
        self.voyage.save()
        message = {
            'voyage_id': str(self.voyage.Id_voyage),
            'nb_places': 10,
        }
        self.consumer._handle_booking_created(message)
        self.voyage.refresh_from_db()
        self.assertEqual(self.voyage.places_disponibles, 1)

    def test_booking_created_voyage_introuvable(self):
        message = {'voyage_id': str(uuid.uuid4()), 'nb_places': 1}
        self.consumer._handle_booking_created(message)  # pas d'exception

    def test_booking_created_sans_voyage_id(self):
        message = {'nb_places': 1}
        self.consumer._handle_booking_created(message)  # pas d'exception

    # ── booking.confirmed ─────────────────────────────────────────────────────

    def test_booking_confirmed_incremente_places_reservees(self):
        message = {
            'voyage_id': str(self.voyage.Id_voyage),
            'nb_places': 3,
        }
        self.consumer._handle_booking_confirmed(message)
        self.voyage.refresh_from_db()
        self.assertEqual(self.voyage.places_total_reservees, 3)

    def test_booking_confirmed_cumule(self):
        self.voyage.places_total_reservees = 5
        self.voyage.save()
        message = {'voyage_id': str(self.voyage.Id_voyage), 'nb_places': 2}
        self.consumer._handle_booking_confirmed(message)
        self.voyage.refresh_from_db()
        self.assertEqual(self.voyage.places_total_reservees, 7)

    def test_booking_confirmed_sans_voyage_id(self):
        message = {'nb_places': 1}
        self.consumer._handle_booking_confirmed(message)

    # ── booking.depart ────────────────────────────────────────────────────────

    def test_booking_depart_passage_en_cours(self):
        message = {'voyage_id': str(self.voyage.Id_voyage)}
        self.consumer._handle_booking_depart(message)
        self.voyage.refresh_from_db()
        self.assertEqual(self.voyage.status, StatusVoyage.EN_COURS)

    def test_booking_depart_deja_en_cours(self):
        """Idempotent : si déjà EN_COURS, on ne fait rien."""
        self.voyage.status = StatusVoyage.EN_COURS
        self.voyage.save()
        message = {'voyage_id': str(self.voyage.Id_voyage)}
        self.consumer._handle_booking_depart(message)
        self.voyage.refresh_from_db()
        self.assertEqual(self.voyage.status, StatusVoyage.EN_COURS)

    def test_booking_depart_sans_voyage_id(self):
        message = {}
        self.consumer._handle_booking_depart(message)

    # ── callbacks on_booking_message ──────────────────────────────────────────

    def test_on_booking_created_ack(self):
        ch, method, props = _make_channel_method('booking.created')
        body = json.dumps({
            'event_type': 'BOOKING_CREATED',
            'voyage_id':  str(self.voyage.Id_voyage),
            'nb_places':  1,
        }).encode()
        self.consumer.on_booking_message(ch, method, props, body)
        ch.basic_ack.assert_called_once()

    def test_on_booking_unknown_routing_key_ack(self):
        ch, method, props = _make_channel_method('booking.unknown')
        body = json.dumps({'event_type': 'X'}).encode()
        self.consumer.on_booking_message(ch, method, props, body)
        ch.basic_ack.assert_called_once()

    def test_on_booking_json_invalide_nack(self):
        ch, method, props = _make_channel_method('booking.created')
        self.consumer.on_booking_message(ch, method, props, b'BAD_JSON')
        ch.basic_nack.assert_called_once_with(
            delivery_tag=method.delivery_tag, requeue=False
        )


# ─────────────────────────────────────────────────────────────────────────────
# Handler chauffeur sync
# ─────────────────────────────────────────────────────────────────────────────

class HandleChauffeurSyncTest(TestCase):

    def setUp(self):
        self.consumer = _make_consumer()
        self.agence   = _make_agence()

    def _payload(self, **overrides):
        payload = {
            'userId':       str(uuid.uuid4()),
            'email':        'pierre@express.cm',
            'name':         'Pierre',
            'surname':      'Kamga',
            'phone':        '699000010',
            'adresse':      'Makepe, Douala',
            'agenceId':     str(self.agence.id_agence),
            'filialeId':    None,
            'numeroPermis': 'PTEST0001',
            'dateEmbauche': '2024-01-15',
        }
        payload.update(overrides)
        return payload

    def test_creation_chauffeur(self):
        payload = self._payload()
        self.consumer._handle_chauffeur_sync(payload)
        self.assertEqual(Chauffeur.objects.count(), 1)
        ch = Chauffeur.objects.first()
        self.assertEqual(ch.email, 'pierre@express.cm')
        self.assertEqual(ch.name, 'Pierre')
        self.assertEqual(ch.Id_agence, self.agence)

    def test_idempotence_meme_user_id(self):
        payload = self._payload()
        self.consumer._handle_chauffeur_sync(payload)
        self.consumer._handle_chauffeur_sync(payload)  # deuxième appel
        self.assertEqual(Chauffeur.objects.count(), 1)

    def test_collision_email_existant(self):
        """Si l'email existe déjà avec un autre user_id, on n'écrase pas."""
        Chauffeur.objects.create(
            id_chauffeur=uuid.uuid4(),
            numero_permis='PEXIST001',
            name='Paul',
            surname='Biya',
            email='pierre@express.cm',
            phone='699000099',
            Adresse='Douala',
            Id_agence=self.agence,
            est_disponible=True,
            date_embauche='2023-01-01',
        )
        payload = self._payload(userId=str(uuid.uuid4()))
        self.consumer._handle_chauffeur_sync(payload)
        self.assertEqual(Chauffeur.objects.count(), 1)

    def test_payload_sans_user_id_ignore(self):
        payload = self._payload(userId=None)
        self.consumer._handle_chauffeur_sync(payload)
        self.assertEqual(Chauffeur.objects.count(), 0)

    def test_payload_sans_email_ignore(self):
        payload = self._payload(email='')
        self.consumer._handle_chauffeur_sync(payload)
        self.assertEqual(Chauffeur.objects.count(), 0)

    def test_agence_introuvable_creation_sans_agence(self):
        payload = self._payload(agenceId=str(uuid.uuid4()))
        self.consumer._handle_chauffeur_sync(payload)
        self.assertEqual(Chauffeur.objects.count(), 1)
        ch = Chauffeur.objects.first()
        self.assertIsNone(ch.Id_agence)

    def test_date_embauche_invalide_utilise_aujourd_hui(self):
        payload = self._payload(dateEmbauche='NOT_A_DATE')
        self.consumer._handle_chauffeur_sync(payload)
        from django.utils.timezone import now
        ch = Chauffeur.objects.first()
        self.assertEqual(ch.date_embauche, now().date())

    def test_date_embauche_vide_utilise_aujourd_hui(self):
        payload = self._payload(dateEmbauche='')
        self.consumer._handle_chauffeur_sync(payload)
        from django.utils.timezone import now
        ch = Chauffeur.objects.first()
        self.assertEqual(ch.date_embauche, now().date())

    def test_date_embauche_datetime_iso(self):
        payload = self._payload(dateEmbauche='2023-06-15T08:00:00Z')
        self.consumer._handle_chauffeur_sync(payload)
        ch = Chauffeur.objects.first()
        from datetime import date
        self.assertEqual(ch.date_embauche, date(2023, 6, 15))

    def test_date_embauche_date_simple(self):
        payload = self._payload(dateEmbauche='2023-06-15')
        self.consumer._handle_chauffeur_sync(payload)
        ch = Chauffeur.objects.first()
        from datetime import date
        self.assertEqual(ch.date_embauche, date(2023, 6, 15))

    def test_uuid_synchronise_depuis_user_service(self):
        user_id = uuid.uuid4()
        payload = self._payload(userId=str(user_id))
        self.consumer._handle_chauffeur_sync(payload)
        ch = Chauffeur.objects.first()
        self.assertEqual(ch.id_chauffeur, user_id)

    def test_email_normalise_lowercase(self):
        payload = self._payload(email='PIERRE@EXPRESS.CM')
        self.consumer._handle_chauffeur_sync(payload)
        ch = Chauffeur.objects.first()
        self.assertEqual(ch.email, 'pierre@express.cm')

    def test_est_disponible_true_par_defaut(self):
        payload = self._payload()
        self.consumer._handle_chauffeur_sync(payload)
        ch = Chauffeur.objects.first()
        self.assertTrue(ch.est_disponible)

    # ── callback on_chauffeur_sync_message ────────────────────────────────────

    def test_on_chauffeur_sync_ack(self):
        ch_mq, method, props = _make_channel_method('chauffeur.to.fleet')
        payload = self._payload()
        body = json.dumps(payload).encode()
        self.consumer.on_chauffeur_sync_message(ch_mq, method, props, body)
        ch_mq.basic_ack.assert_called_once()
        self.assertEqual(Chauffeur.objects.count(), 1)

    def test_on_chauffeur_sync_json_invalide_nack(self):
        ch_mq, method, props = _make_channel_method('chauffeur.to.fleet')
        self.consumer.on_chauffeur_sync_message(ch_mq, method, props, b'NOT_JSON')
        ch_mq.basic_nack.assert_called_once_with(
            delivery_tag=method.delivery_tag, requeue=False
        )


# ─────────────────────────────────────────────────────────────────────────────
# Callback utilisateur (on_user_message)
# ─────────────────────────────────────────────────────────────────────────────

class OnUserMessageTest(TestCase):

    def setUp(self):
        self.consumer = _make_consumer()

    def test_ack_message_valide(self):
        ch, method, props = _make_channel_method('user.created')
        body = json.dumps({'event_type': 'USER_CREATED'}).encode()
        self.consumer.on_user_message(ch, method, props, body)
        ch.basic_ack.assert_called_once()

    def test_nack_json_invalide(self):
        ch, method, props = _make_channel_method('user.created')
        self.consumer.on_user_message(ch, method, props, b'INVALID')
        ch.basic_nack.assert_called_once_with(
            delivery_tag=method.delivery_tag, requeue=False
        )


# ─────────────────────────────────────────────────────────────────────────────
# Connexion et cycle de vie
# ─────────────────────────────────────────────────────────────────────────────

class ConsumerLifecycleTest(TestCase):

    def setUp(self):
        self.consumer = _make_consumer()

    @patch('fleet.consumers.pika.BlockingConnection')
    def test_connect_success(self, mock_conn_cls):
        mock_conn    = MagicMock()
        mock_channel = MagicMock()
        mock_conn_cls.return_value = mock_conn
        mock_conn.channel.return_value = mock_channel
        mock_conn.is_closed = False

        result = self.consumer.connect()

        self.assertTrue(result)
        self.assertIsNotNone(self.consumer.connection)
        self.assertIsNotNone(self.consumer.channel)

    @patch('fleet.consumers.pika.BlockingConnection')
    def test_connect_failure(self, mock_conn_cls):
        mock_conn_cls.side_effect = Exception('Connection refused')
        result = self.consumer.connect()
        self.assertFalse(result)

    @patch('fleet.consumers.pika.BlockingConnection')
    def test_connect_ne_reconnecte_pas_si_deja_connecte(self, mock_conn_cls):
        mock_conn = MagicMock()
        mock_conn.is_closed = False
        self.consumer.connection = mock_conn
        result = self.consumer.connect()
        self.assertTrue(result)
        mock_conn_cls.assert_not_called()

    def test_stop_consuming_si_pas_actif(self):
        """Doit sortir sans erreur si is_consuming=False."""
        self.consumer.is_consuming = False
        self.consumer.stop_consuming()  # pas d'exception

    @patch('fleet.consumers.pika.BlockingConnection')
    def test_stop_consuming(self, mock_conn_cls):
        mock_conn    = MagicMock()
        mock_channel = MagicMock()
        mock_conn_cls.return_value = mock_conn
        mock_conn.channel.return_value = mock_channel
        mock_conn.is_closed = False

        self.consumer.connect()
        self.consumer.is_consuming = True
        self.consumer.stop_consuming()

        mock_channel.stop_consuming.assert_called_once()
        self.assertFalse(self.consumer.is_consuming)

    @patch('fleet.consumers.RabbitMQConsumer.start_consuming')
    def test_run_in_thread(self, mock_start):
        self.consumer.run_in_thread()
        import time
        time.sleep(0.1)  # laisser le thread démarrer
        self.assertIsNotNone(self.consumer.consumer_thread)
        self.assertTrue(self.consumer.consumer_thread.daemon)