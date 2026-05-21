"""
test_rabbitmq.py — Tests unitaires du module rabbitmq.py (publisher).

Couverture :
  - publish() : connexion, publication, fermeture, retry
  - Gestion des erreurs réseau (AMQPConnectionError, StreamLostError)
  - Abandon après 2 tentatives
  - Fonctions publish_* spécialisées (agence, filiale, voyage, bus, etc.)
  - Compatibilité rabbitmq_client.publish()
  - _get_connection_params() lit bien les settings Django
"""

import json
import uuid
from decimal import Decimal
from unittest.mock import MagicMock, patch, call, PropertyMock
import pika
from django.test import TestCase, override_settings
from django.utils import timezone

from fleet.rabbitmq import (
    publish,
    rabbitmq_client,
    publish_agence_created,
    publish_agence_updated,
    publish_filiale_created,
    publish_filiale_updated,
    publish_staff_created,
    publish_agence_subscription_request,
    publish_voyage_delayed,
    publish_voyage_departed,
    publish_bus_status_changed,
    publish_bus_breakdown,
    publish_annonce_published,
    publish_voyage_cancelled,
    publish_agency_updated_for_booking,
    publish_filiale_updated_for_booking,
    publish_voyage_updated_for_booking,
    publish_bus_updated_for_booking,
    EXCHANGE_USER, EXCHANGE_FLEET, EXCHANGE_BOOKING,
    EXCHANGE_NOTIFICATION, EXCHANGE_SUBSCRIBE,
)


# ─────────────────────────────────────────────────────────────────────────────
# Helpers — objets modèles factices
# ─────────────────────────────────────────────────────────────────────────────

def _make_agence():
    agence = MagicMock()
    agence.id_agence      = uuid.uuid4()
    agence.name           = 'Express Voyages'
    agence.adresse        = 'Douala'
    agence.telephone      = '699000001'
    agence.email_officiel = 'contact@express.cm'
    agence.statut_global  = 'active'
    agence.logo_url       = None
    return agence


def _make_filiale(agence=None):
    if agence is None:
        agence = _make_agence()
    filiale = MagicMock()
    filiale.id_filiale = uuid.uuid4()
    filiale.agence     = agence
    filiale.nom        = 'Agence Douala Centre'
    filiale.code       = 'DLA-001'
    filiale.ville      = 'Douala'
    filiale.adresse    = '456 Rue Joffre, Douala'
    filiale.telephone  = '699000002'
    filiale.email      = 'douala@express.cm'
    filiale.est_active = True
    return filiale


def _make_bus(agence=None):
    if agence is None:
        agence = _make_agence()
    bus = MagicMock()
    bus.IdBus           = 1
    bus.immatriculation = 'LT001AB'
    bus.modele          = 'Toyota Coaster'
    bus.capacite        = 30
    bus.etat            = 'disponible'
    bus.Id_agence       = agence
    return bus


def _make_chauffeur():
    ch = MagicMock()
    ch.name    = 'Pierre'
    ch.surname = 'Kamga'
    return ch


def _make_voyage():
    agence   = _make_agence()
    bus      = _make_bus(agence)
    chauffeur = _make_chauffeur()

    trajet = MagicMock()
    trajet.filiale_depart = MagicMock(
        code='DLA-001', nom='Douala Centre', ville='Douala'
    )
    trajet.filiale_arrive = MagicMock(
        code='YDE-001', nom='Yaoundé Centre', ville='Yaoundé'
    )

    voyage = MagicMock()
    voyage.Id_voyage                = uuid.uuid4()
    voyage.status                   = 'programme'
    voyage.type_voyage              = 'standard'
    voyage.prix                     = Decimal('5000.00')
    voyage.places_disponibles       = 30
    voyage.places_total_reservees   = 0
    voyage.date_heure_depart        = timezone.now()
    voyage.date_heure_arrive_prevue = timezone.now() + timezone.timedelta(hours=5)
    voyage.Id_trajet                = trajet
    voyage.IdBus                    = bus
    voyage.id_chauffeur             = chauffeur
    return voyage


def _make_annonce():
    voyage  = _make_voyage()
    annonce = MagicMock()
    annonce.id_annonce = uuid.uuid4()
    annonce.type       = 'information'
    annonce.message    = 'Voyage maintenu'
    annonce.Id_voyage  = voyage
    return annonce


# ─────────────────────────────────────────────────────────────────────────────
# Tests de la fonction publish()
# ─────────────────────────────────────────────────────────────────────────────

class PublishFunctionTest(TestCase):

    @patch('fleet.rabbitmq.pika.BlockingConnection')
    def test_publication_reussie(self, mock_conn_cls):
        mock_conn    = MagicMock()
        mock_channel = MagicMock()
        mock_conn_cls.return_value = mock_conn
        mock_conn.channel.return_value = mock_channel
        mock_conn.is_closed = False

        result = publish(EXCHANGE_USER, 'agence.created', {'event_type': 'TEST'})

        self.assertTrue(result)
        mock_channel.basic_publish.assert_called_once()
        mock_conn.close.assert_called_once()

    @patch('fleet.rabbitmq.pika.BlockingConnection')
    def test_publication_ferme_connexion_meme_en_cas_erreur(self, mock_conn_cls):
        mock_conn    = MagicMock()
        mock_channel = MagicMock()
        mock_conn_cls.return_value = mock_conn
        mock_conn.channel.return_value = mock_channel
        mock_conn.is_closed = False
        mock_channel.basic_publish.side_effect = Exception('Erreur inattendue')

        result = publish(EXCHANGE_USER, 'test.key', {'k': 'v'})

        self.assertFalse(result)
        mock_conn.close.assert_called()

    @patch('fleet.rabbitmq.pika.BlockingConnection')
    def test_retry_sur_erreur_reseau(self, mock_conn_cls):
        """Doit retenter 1 fois sur AMQPConnectionError, puis réussir."""
        mock_conn    = MagicMock()
        mock_channel = MagicMock()
        mock_conn_cls.side_effect = [
            pika.exceptions.AMQPConnectionError(),  # 1re tentative échoue
            mock_conn,                              # 2e tentative réussit
        ]
        mock_conn.channel.return_value = mock_channel
        mock_conn.is_closed = False

        result = publish(EXCHANGE_USER, 'test.key', {'k': 'v'})

        self.assertTrue(result)
        self.assertEqual(mock_conn_cls.call_count, 2)

    @patch('fleet.rabbitmq.pika.BlockingConnection')
    def test_abandon_apres_deux_tentatives(self, mock_conn_cls):
        mock_conn_cls.side_effect = pika.exceptions.AMQPConnectionError()
        result = publish(EXCHANGE_USER, 'test.key', {'k': 'v'})
        self.assertFalse(result)
        self.assertEqual(mock_conn_cls.call_count, 2)

    @patch('fleet.rabbitmq.pika.BlockingConnection')
    def test_message_serialise_en_json(self, mock_conn_cls):
        mock_conn    = MagicMock()
        mock_channel = MagicMock()
        mock_conn_cls.return_value = mock_conn
        mock_conn.channel.return_value = mock_channel
        mock_conn.is_closed = False

        message = {'event_type': 'TEST', 'id': str(uuid.uuid4())}
        publish(EXCHANGE_USER, 'test.key', message)

        args, kwargs = mock_channel.basic_publish.call_args
        body = kwargs.get('body') or args[0] if args else None
        if body is None:
            # basic_publish appelé avec des kwargs
            call_kwargs = mock_channel.basic_publish.call_args[1]
            body = call_kwargs['body']
        parsed = json.loads(body)
        self.assertEqual(parsed['event_type'], 'TEST')

    @patch('fleet.rabbitmq.pika.BlockingConnection')
    def test_message_persistant(self, mock_conn_cls):
        """delivery_mode=2 doit être positionné."""
        mock_conn    = MagicMock()
        mock_channel = MagicMock()
        mock_conn_cls.return_value = mock_conn
        mock_conn.channel.return_value = mock_channel
        mock_conn.is_closed = False

        publish(EXCHANGE_USER, 'test.key', {'k': 'v'})

        call_kwargs = mock_channel.basic_publish.call_args[1]
        props = call_kwargs['properties']
        self.assertEqual(props.delivery_mode, 2)

    @patch('fleet.rabbitmq.pika.BlockingConnection')
    def test_connexion_fermee_si_deja_fermee(self, mock_conn_cls):
        """Si is_closed=True, on ne rappelle pas close()."""
        mock_conn    = MagicMock()
        mock_channel = MagicMock()
        mock_conn_cls.return_value = mock_conn
        mock_conn.channel.return_value = mock_channel
        mock_conn.is_closed = True

        publish(EXCHANGE_USER, 'test.key', {'k': 'v'})
        mock_conn.close.assert_not_called()


# ─────────────────────────────────────────────────────────────────────────────
# Compatibilité rabbitmq_client
# ─────────────────────────────────────────────────────────────────────────────

class RabbitmqClientCompatTest(TestCase):

    @patch('fleet.rabbitmq.publish')
    def test_client_delegu_a_publish(self, mock_publish):
        mock_publish.return_value = True
        result = rabbitmq_client.publish(EXCHANGE_USER, 'test.key', {'k': 'v'})
        mock_publish.assert_called_once_with(EXCHANGE_USER, 'test.key', {'k': 'v'})
        self.assertTrue(result)


# ─────────────────────────────────────────────────────────────────────────────
# Tests des fonctions publish_* spécialisées
# ─────────────────────────────────────────────────────────────────────────────

class PublishAgenceTest(TestCase):

    @patch('fleet.rabbitmq.publish')
    def test_publish_agence_created(self, mock_publish):
        mock_publish.return_value = True
        agence = _make_agence()
        result = publish_agence_created(agence)
        self.assertTrue(result)
        mock_publish.assert_called_once()
        args = mock_publish.call_args[0]
        self.assertEqual(args[0], EXCHANGE_USER)
        self.assertEqual(args[1], 'agence.created')
        payload = args[2]
        self.assertEqual(payload['event_type'], 'AGENCE_CREATED')
        self.assertEqual(payload['agence_id'], str(agence.id_agence))

    @patch('fleet.rabbitmq.publish')
    def test_publish_agence_updated(self, mock_publish):
        mock_publish.return_value = True
        agence = _make_agence()
        result = publish_agence_updated(agence)
        self.assertTrue(result)
        args = mock_publish.call_args[0]
        self.assertEqual(args[1], 'agence.updated')
        self.assertEqual(args[2]['event_type'], 'AGENCE_UPDATED')

    @patch('fleet.rabbitmq.publish')
    def test_publish_agence_created_echec(self, mock_publish):
        mock_publish.return_value = False
        result = publish_agence_created(_make_agence())
        self.assertFalse(result)

    @patch('fleet.rabbitmq.publish')
    def test_publish_agency_updated_for_booking(self, mock_publish):
        mock_publish.return_value = True
        agence = _make_agence()
        result = publish_agency_updated_for_booking(agence)
        self.assertTrue(result)
        args = mock_publish.call_args[0]
        self.assertEqual(args[0], EXCHANGE_FLEET)
        self.assertEqual(args[1], 'agency.updated')

    @patch('fleet.rabbitmq.publish')
    def test_publish_agence_subscription_request(self, mock_publish):
        mock_publish.return_value = True
        agence = _make_agence()
        result = publish_agence_subscription_request(agence)
        self.assertTrue(result)
        args = mock_publish.call_args[0]
        self.assertEqual(args[0], EXCHANGE_SUBSCRIBE)
        self.assertEqual(args[2]['event_type'], 'SUBSCRIPTION_REQUEST')


class PublishFilialeTest(TestCase):

    @patch('fleet.rabbitmq.publish')
    def test_publish_filiale_created(self, mock_publish):
        mock_publish.return_value = True
        filiale = _make_filiale()
        result = publish_filiale_created(filiale)
        self.assertTrue(result)
        args = mock_publish.call_args[0]
        self.assertEqual(args[1], 'filiale.created')
        self.assertEqual(args[2]['event_type'], 'FILIALE_CREATED')

    @patch('fleet.rabbitmq.publish')
    def test_publish_filiale_updated(self, mock_publish):
        mock_publish.return_value = True
        filiale = _make_filiale()
        result = publish_filiale_updated(filiale)
        self.assertTrue(result)
        args = mock_publish.call_args[0]
        self.assertEqual(args[1], 'filiale.updated')

    @patch('fleet.rabbitmq.publish')
    def test_publish_filiale_updated_for_booking(self, mock_publish):
        mock_publish.return_value = True
        filiale = _make_filiale()
        result = publish_filiale_updated_for_booking(filiale)
        self.assertTrue(result)
        args = mock_publish.call_args[0]
        self.assertEqual(args[0], EXCHANGE_FLEET)
        self.assertEqual(args[1], 'filiale.updated')


class PublishStaffTest(TestCase):

    @patch('fleet.rabbitmq.publish')
    def test_publish_staff_created_chauffeur(self, mock_publish):
        mock_publish.return_value = True
        user_id   = uuid.uuid4()
        agence_id = uuid.uuid4()
        result = publish_staff_created(
            user_id=user_id, role='CHAUFFEUR', agence_id=agence_id
        )
        self.assertTrue(result)
        args = mock_publish.call_args[0]
        payload = args[2]
        self.assertEqual(payload['event_type'], 'STAFF_CREATED')
        self.assertEqual(payload['role'], 'CHAUFFEUR')
        self.assertEqual(payload['agence_id'], str(agence_id))
        self.assertIsNone(payload['filiale_id'])

    @patch('fleet.rabbitmq.publish')
    def test_publish_staff_created_guichetier(self, mock_publish):
        mock_publish.return_value = True
        filiale_id = uuid.uuid4()
        result = publish_staff_created(
            user_id=uuid.uuid4(), role='GUICHETIER', filiale_id=filiale_id
        )
        self.assertTrue(result)
        payload = mock_publish.call_args[0][2]
        self.assertEqual(payload['role'], 'GUICHETIER')
        self.assertEqual(payload['filiale_id'], str(filiale_id))


class PublishVoyageTest(TestCase):

    @patch('fleet.rabbitmq.publish')
    def test_publish_voyage_cancelled(self, mock_publish):
        mock_publish.return_value = True
        voyage = _make_voyage()
        result = publish_voyage_cancelled(voyage, 'Problème technique')
        self.assertTrue(result)
        args = mock_publish.call_args[0]
        self.assertEqual(args[0], EXCHANGE_BOOKING)
        self.assertEqual(args[1], 'voyage.cancelled')
        self.assertEqual(args[2]['event_type'], 'VOYAGE_CANCELLED')
        self.assertEqual(args[2]['motif'], 'Problème technique')

    @patch('fleet.rabbitmq.publish')
    def test_publish_voyage_delayed(self, mock_publish):
        mock_publish.return_value = True
        voyage = _make_voyage()
        nouveau_depart = timezone.now() + timezone.timedelta(hours=3)
        result = publish_voyage_delayed(voyage, nouveau_depart)
        self.assertTrue(result)
        args = mock_publish.call_args[0]
        self.assertEqual(args[0], EXCHANGE_NOTIFICATION)
        self.assertEqual(args[2]['event_type'], 'VOYAGE_DELAYED')

    @patch('fleet.rabbitmq.publish')
    def test_publish_voyage_departed(self, mock_publish):
        mock_publish.return_value = True
        voyage = _make_voyage()
        result = publish_voyage_departed(voyage)
        self.assertTrue(result)
        args = mock_publish.call_args[0]
        self.assertEqual(args[2]['event_type'], 'VOYAGE_DEPARTED')

    @patch('fleet.rabbitmq.publish')
    def test_publish_voyage_updated_for_booking(self, mock_publish):
        mock_publish.return_value = True
        voyage = _make_voyage()
        result = publish_voyage_updated_for_booking(voyage)
        self.assertTrue(result)
        args = mock_publish.call_args[0]
        self.assertEqual(args[0], EXCHANGE_FLEET)
        payload = args[2]
        self.assertEqual(payload['event_type'], 'VOYAGE_UPDATED')
        self.assertIn('origine',     payload)
        self.assertIn('destination', payload)
        self.assertIn('bus',         payload)

    @patch('fleet.rabbitmq.publish')
    def test_publish_voyage_updated_payload_complet(self, mock_publish):
        mock_publish.return_value = True
        voyage = _make_voyage()
        publish_voyage_updated_for_booking(voyage)
        payload = mock_publish.call_args[0][2]
        self.assertEqual(payload['status'], voyage.status)
        self.assertEqual(payload['places_disponibles'], voyage.places_disponibles)
        self.assertIn('agence_code', payload)


class PublishBusTest(TestCase):

    @patch('fleet.rabbitmq.publish')
    def test_publish_bus_status_changed(self, mock_publish):
        mock_publish.return_value = True
        bus = _make_bus()
        result = publish_bus_status_changed(bus, 'disponible', 'en_panne', 'Panne moteur')
        self.assertTrue(result)
        args = mock_publish.call_args[0]
        self.assertEqual(args[0], EXCHANGE_NOTIFICATION)
        payload = args[2]
        self.assertEqual(payload['event_type'], 'BUS_STATUS_CHANGED')
        self.assertEqual(payload['ancien_status'], 'disponible')
        self.assertEqual(payload['nouveau_status'], 'en_panne')

    @patch('fleet.rabbitmq.publish')
    def test_publish_bus_breakdown(self, mock_publish):
        mock_publish.return_value = True
        bus = _make_bus()
        result = publish_bus_breakdown(bus, 'Panne de frein')
        self.assertTrue(result)
        args = mock_publish.call_args[0]
        self.assertEqual(args[2]['event_type'], 'BUS_BREAKDOWN')
        self.assertEqual(args[2]['motif'], 'Panne de frein')

    @patch('fleet.rabbitmq.publish')
    def test_publish_bus_updated_for_booking(self, mock_publish):
        mock_publish.return_value = True
        bus = _make_bus()
        result = publish_bus_updated_for_booking(bus)
        self.assertTrue(result)
        args = mock_publish.call_args[0]
        self.assertEqual(args[0], EXCHANGE_FLEET)
        self.assertEqual(args[2]['event_type'], 'BUS_UPDATED')


class PublishAnnonceTest(TestCase):

    @patch('fleet.rabbitmq.publish')
    def test_publish_annonce_published(self, mock_publish):
        mock_publish.return_value = True
        annonce = _make_annonce()
        result = publish_annonce_published(annonce)
        self.assertTrue(result)
        args = mock_publish.call_args[0]
        self.assertEqual(args[0], EXCHANGE_NOTIFICATION)
        self.assertEqual(args[2]['event_type'], 'ANNONCE_PUBLISHED')


# ─────────────────────────────────────────────────────────────────────────────
# Settings
# ─────────────────────────────────────────────────────────────────────────────

class ConnectionParamsTest(TestCase):

    @override_settings(
        RABBITMQ_HOST='my-rabbit',
        RABBITMQ_PORT=5673,
        RABBITMQ_USER='admin',
        RABBITMQ_PASSWORD='secret',
        RABBITMQ_VHOST='/fleet',
    )
    def test_params_depuis_settings(self):
        from fleet.rabbitmq import _get_connection_params
        params = _get_connection_params()
        self.assertEqual(params.host, 'my-rabbit')
        self.assertEqual(params.port, 5673)
        self.assertEqual(params.virtual_host, '/fleet')