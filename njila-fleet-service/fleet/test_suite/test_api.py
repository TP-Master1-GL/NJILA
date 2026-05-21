"""
test_api.py — Tests d'intégration des vues DRF du fleet-service.

Couverture :
  - Agences   : CRUD + filtrage RBAC
  - Filiales  : CRUD + stats + filtrage RBAC
  - Bus       : CRUD + statut + disponibles
  - Chauffeurs: CRUD + disponibilité
  - Guichetiers: CRUD + filtrage RBAC
  - Trajets   : CRUD
  - Voyages   : CRUD + statut + recherche + assignation bus/chauffeur
  - Annonces  : CRUD
  - Avis      : CRUD + stats
  - Health check
  - Middleware JWT (chemins publics vs protégés)
"""

import json
import uuid
from decimal import Decimal
from unittest.mock import patch, MagicMock
from django.test import TestCase, Client
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from fleet.models import (
    Agence, Filiale, Bus, Chauffeur, Guichetier, Trajet,
    Voyage, Annonce, Avis,
    StatusBus, StatusVoyage, StatutGlobalAgence, TypeVoyage, TypeAnnonce,
)


# ─────────────────────────────────────────────────────────────────────────────
# Client authentifié (bypass middleware JWT via injection user_info)
# ─────────────────────────────────────────────────────────────────────────────

class AuthenticatedClient(APIClient):
    """APIClient qui injecte directement user_info dans la requête,
    court-circuitant l'appel au auth-service externe."""

    def __init__(self, role='ADMIN', agence_id=None, filiale_id=None, user_id=None):
        super().__init__()
        self._user_info = {
            'userId':    str(user_id or uuid.uuid4()),
            'role':      role,
            'agenceId':  str(agence_id) if agence_id else None,
            'filialeId': str(filiale_id) if filiale_id else None,
        }

    def _get_mock_auth_response(self):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'valid': True,
            'payload': {
                'userId':    self._user_info['userId'],
                'role':      self._user_info['role'],
                'agenceId':  self._user_info['agenceId'],
                'filialeId': self._user_info['filialeId'],
                'sessionId': str(uuid.uuid4()),
                'exp':       9999999999,
            }
        }
        return mock_response

    def _request(self, method, path, data=None, content_type='application/json', **extra):
        with patch('fleet.middleware.requests.post') as mock_post:
            mock_post.return_value = self._get_mock_auth_response()
            extra.setdefault('HTTP_AUTHORIZATION', 'Bearer fake-token')
            return super()._request(
                method, path, data=data, content_type=content_type, **extra
            )

    def get(self, path, data=None, **extra):
        extra.setdefault('HTTP_AUTHORIZATION', 'Bearer fake-token')
        with patch('fleet.middleware.requests.post') as mock_post:
            mock_post.return_value = self._get_mock_auth_response()
            return super().get(path, data=data, **extra)

    def post(self, path, data=None, format=None, content_type=None, **extra):
        extra.setdefault('HTTP_AUTHORIZATION', 'Bearer fake-token')
        with patch('fleet.middleware.requests.post') as mock_post:
            mock_post.return_value = self._get_mock_auth_response()
            return super().post(path, data=data, format=format or 'json', **extra)

    def patch(self, path, data=None, format=None, content_type=None, **extra):
        extra.setdefault('HTTP_AUTHORIZATION', 'Bearer fake-token')
        with patch('fleet.middleware.requests.post') as mock_post:
            mock_post.return_value = self._get_mock_auth_response()
            return super().patch(path, data=data, format=format or 'json', **extra)

    def put(self, path, data=None, format=None, content_type=None, **extra):
        extra.setdefault('HTTP_AUTHORIZATION', 'Bearer fake-token')
        with patch('fleet.middleware.requests.post') as mock_post:
            mock_post.return_value = self._get_mock_auth_response()
            return super().put(path, data=data, format=format or 'json', **extra)

    def delete(self, path, **extra):
        extra.setdefault('HTTP_AUTHORIZATION', 'Bearer fake-token')
        with patch('fleet.middleware.requests.post') as mock_post:
            mock_post.return_value = self._get_mock_auth_response()
            return super().delete(path, **extra)


# ─────────────────────────────────────────────────────────────────────────────
# Fixtures DB
# ─────────────────────────────────────────────────────────────────────────────

def make_agence(**kw):
    return Agence.objects.create(
        name=kw.get('name', 'Express Voyages'),
        adresse=kw.get('adresse', '123 Bd de la Liberté, Douala'),
        telephone=kw.get('telephone', '699000001'),
        email_officiel=kw.get('email_officiel', 'contact@express.cm'),
        statut_global=kw.get('statut_global', StatutGlobalAgence.ACTIVE),
    )


def make_filiale(agence, **kw):
    return Filiale.objects.create(
        agence=agence,
        nom=kw.get('nom', 'Filiale Douala'),
        code=kw.get('code', 'DLA-001'),
        ville=kw.get('ville', 'Douala'),
        adresse=kw.get('adresse', '456 Rue Joffre'),
        telephone=kw.get('telephone', '699000002'),
        email=kw.get('email', 'dla@express.cm'),
        est_active=kw.get('est_active', True),
    )


def make_bus(agence, **kw):
    return Bus.objects.create(
        modele=kw.get('modele', 'Toyota Coaster'),
        immatriculation=kw.get('immatriculation', 'LT001AB'),
        capacite=kw.get('capacite', 30),
        etat=kw.get('etat', StatusBus.DISPONIBLE),
        Id_agence=agence,
    )


def make_chauffeur(agence, **kw):
    return Chauffeur.objects.create(
        numero_permis=kw.get('numero_permis', 'P12345678'),
        name=kw.get('name', 'Pierre'),
        surname=kw.get('surname', 'Kamga'),
        email=kw.get('email', 'pierre@express.cm'),
        phone=kw.get('phone', '699000003'),
        Adresse=kw.get('Adresse', 'Makepe, Douala'),
        Id_agence=agence,
        est_disponible=kw.get('est_disponible', True),
        date_embauche=kw.get('date_embauche', '2023-01-15'),
    )


def make_trajet(f_dep, f_arr, **kw):
    return Trajet.objects.create(
        filiale_depart=f_dep,
        filiale_arrive=f_arr,
        distance=kw.get('distance', 250.0),
        est_actif=kw.get('est_actif', True),
    )


def make_voyage(trajet, bus, chauffeur=None, **kw):
    now = timezone.now()
    return Voyage.objects.create(
        date_heure_depart=kw.get('date_heure_depart', now + timezone.timedelta(hours=2)),
        date_heure_arrive_prevue=kw.get('date_heure_arrive_prevue', now + timezone.timedelta(hours=7)),
        prix=kw.get('prix', Decimal('5000.00')),
        type_voyage=kw.get('type_voyage', TypeVoyage.STANDARD),
        status=kw.get('status', StatusVoyage.PROGRAMME),
        places_disponibles=kw.get('places_disponibles', 30),
        id_chauffeur=chauffeur,
        IdBus=bus,
        Id_trajet=trajet,
    )


# ─────────────────────────────────────────────────────────────────────────────
# AGENCES
# ─────────────────────────────────────────────────────────────────────────────

class AgenceListCreateAPITest(TestCase):

    def setUp(self):
        self.client_anon  = APIClient()
        self.client_admin = AuthenticatedClient(role='ADMIN')
        self.client_mg    = None  # défini dans les tests avec agenceId

    @patch('fleet.views.publish_agence_created', return_value=True)
    @patch('fleet.views.publish_agence_subscription_request', return_value=True)
    @patch('fleet.views.publish_agency_updated_for_booking', return_value=True)
    def test_create_agence_admin(self, *mocks):
        data = {
            'name': 'Rapide Express',
            'adresse': 'Douala',
            'telephone': '699111111',
            'email_officiel': 'rapide@express.cm',
        }
        response = self.client_admin.post('/api/agences/', data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Agence.objects.count(), 1)

    def test_list_agences_public(self):
        make_agence()
        response = self.client_anon.get('/api/agences/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results'] if 'results' in response.data else response.data), 1)

    def test_create_agence_non_admin_refuse(self):
        client_mg = AuthenticatedClient(role='MANAGER_GLOBAL')
        data = {
            'name': 'Tentative', 'adresse': 'Douala',
            'telephone': '699000099', 'email_officiel': 'tent@test.cm',
        }
        response = client_mg.post('/api/agences/', data)
        self.assertIn(response.status_code, [
            status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN
        ])

    def test_list_filtrage_statut(self):
        make_agence(statut_global='active')
        make_agence(name='Agence2', email_officiel='a2@test.cm', statut_global='expiree')
        response = self.client_anon.get('/api/agences/?statut_global=active')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data
        results = data.get('results', data)
        for ag in results:
            self.assertEqual(ag['statut_global'], 'active')

    @patch('fleet.views.publish_agence_created', return_value=True)
    @patch('fleet.views.publish_agence_subscription_request', return_value=True)
    @patch('fleet.views.publish_agency_updated_for_booking', return_value=True)
    def test_create_agence_inclut_events_dans_reponse(self, *mocks):
        data = {
            'name': 'Events Test', 'adresse': 'Douala',
            'telephone': '699999001', 'email_officiel': 'evtest@test.cm',
        }
        response = self.client_admin.post('/api/agences/', data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('_events', response.data)

    def test_create_agence_sans_auth_refuse(self):
        data = {
            'name': 'Test', 'adresse': 'Douala',
            'telephone': '699000000', 'email_officiel': 'test@test.cm',
        }
        response = self.client_anon.post('/api/agences/', data)
        self.assertIn(response.status_code, [
            status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN
        ])


class AgenceDetailAPITest(TestCase):

    def setUp(self):
        self.agence       = make_agence()
        self.client_anon  = APIClient()
        self.client_admin = AuthenticatedClient(role='ADMIN')

    def test_get_agence_public(self):
        response = self.client_anon.get(f'/api/agences/{self.agence.id_agence}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['name'], 'Express Voyages')

    def test_get_agence_inexistante(self):
        response = self.client_anon.get(f'/api/agences/{uuid.uuid4()}/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    @patch('fleet.views.publish_agence_updated', return_value=True)
    @patch('fleet.views.publish_agency_updated_for_booking', return_value=True)
    def test_patch_agence_admin(self, *mocks):
        response = self.client_admin.patch(
            f'/api/agences/{self.agence.id_agence}/',
            {'telephone': '699888888'},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.agence.refresh_from_db()
        self.assertEqual(self.agence.telephone, '699888888')

    @patch('fleet.views.publish_agence_updated', return_value=True)
    @patch('fleet.views.publish_agency_updated_for_booking', return_value=True)
    def test_patch_agence_manager_global_sa_propre_agence(self, *mocks):
        client_mg = AuthenticatedClient(
            role='MANAGER_GLOBAL', agence_id=self.agence.id_agence
        )
        response = client_mg.patch(
            f'/api/agences/{self.agence.id_agence}/',
            {'telephone': '699777777'},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_delete_agence_admin(self):
        response = self.client_admin.delete(f'/api/agences/{self.agence.id_agence}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(Agence.objects.count(), 0)

    def test_delete_agence_avec_bus_refuse(self):
        make_bus(self.agence)
        response = self.client_admin.delete(f'/api/agences/{self.agence.id_agence}/')
        self.assertIn(response.status_code, [
            status.HTTP_400_BAD_REQUEST, status.HTTP_409_CONFLICT
        ])

    @patch('fleet.views.publish_agence_updated', return_value=True)
    @patch('fleet.views.publish_agency_updated_for_booking', return_value=True)
    def test_patch_agence_manager_global_autre_agence_refuse(self, *mocks):
        autre_agence = make_agence(name='Autre', email_officiel='autre@test.cm')
        client_mg = AuthenticatedClient(
            role='MANAGER_GLOBAL', agence_id=uuid.uuid4()
        )
        response = client_mg.patch(
            f'/api/agences/{autre_agence.id_agence}/',
            {'telephone': '699000000'},
        )
        self.assertIn(response.status_code, [
            status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN
        ])


# ─────────────────────────────────────────────────────────────────────────────
# FILIALES
# ─────────────────────────────────────────────────────────────────────────────

class FilialeAPITest(TestCase):

    def setUp(self):
        self.agence      = make_agence()
        self.client_anon = APIClient()
        self.client_mg   = AuthenticatedClient(
            role='MANAGER_GLOBAL', agence_id=self.agence.id_agence
        )
        self.client_admin = AuthenticatedClient(role='ADMIN')

    @patch('fleet.views.publish_filiale_created', return_value=True)
    @patch('fleet.views.publish_filiale_updated_for_booking', return_value=True)
    def test_create_filiale_manager_global(self, *mocks):
        data = {
            'nom': 'Filiale Test', 'code': 'TST-001', 'ville': 'Douala',
            'adresse': 'Rue Test', 'telephone': '699000005',
            'email': 'test@express.cm', 'agence': str(self.agence.id_agence),
        }
        response = self.client_mg.post('/api/filiales/', data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_list_filiales_public(self):
        make_filiale(self.agence)
        response = self.client_anon.get('/api/filiales/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_get_filiale_public(self):
        f = make_filiale(self.agence)
        response = self.client_anon.get(f'/api/filiales/{f.id_filiale}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['nom'], 'Filiale Douala')

    @patch('fleet.views.publish_filiale_updated', return_value=True)
    @patch('fleet.views.publish_filiale_updated_for_booking', return_value=True)
    def test_patch_filiale_manager_global(self, *mocks):
        f = make_filiale(self.agence)
        response = self.client_mg.patch(
            f'/api/filiales/{f.id_filiale}/',
            {'telephone': '699888999'},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_create_filiale_non_mg_refuse(self):
        client_ml = AuthenticatedClient(role='MANAGER_LOCAL')
        data = {
            'nom': 'Test', 'code': 'T01', 'ville': 'Douala',
            'adresse': 'X', 'telephone': '699000000',
            'email': 'x@x.cm', 'agence': str(self.agence.id_agence),
        }
        response = client_ml.post('/api/filiales/', data)
        self.assertIn(response.status_code, [
            status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN
        ])

    def test_stats_filiale(self):
        f = make_filiale(self.agence)
        response = self.client_anon.get(f'/api/filiales/{f.id_filiale}/stats/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('bus_stats', response.data)
        self.assertIn('voyages_stats', response.data)


# ─────────────────────────────────────────────────────────────────────────────
# BUS
# ─────────────────────────────────────────────────────────────────────────────

class BusAPITest(TestCase):

    def setUp(self):
        self.agence      = make_agence()
        self.filiale     = make_filiale(self.agence)
        self.client_anon = APIClient()
        self.client_ml   = AuthenticatedClient(
            role='MANAGER_LOCAL',
            agence_id=self.agence.id_agence,
            filiale_id=self.filiale.id_filiale,
        )

    @patch('fleet.views.publish_bus_updated_for_booking', return_value=True)
    def test_create_bus_manager_local(self, *mocks):
        data = {
            'modele': 'Mercedes Sprinter',
            'immatriculation': 'CE001AB',
            'capacite': 20,
            'etat': 'disponible',
            'Id_agence': self.agence.id_agence,
        }
        response = self.client_ml.post('/api/bus/', data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_list_bus_public(self):
        make_bus(self.agence)
        response = self.client_anon.get('/api/bus/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_get_bus_public(self):
        bus = make_bus(self.agence)
        response = self.client_anon.get(f'/api/bus/{bus.IdBus}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    @patch('fleet.views.publish_bus_updated_for_booking', return_value=True)
    def test_patch_bus_manager_local(self, *mocks):
        bus = make_bus(self.agence)
        response = self.client_ml.patch(
            f'/api/bus/{bus.IdBus}/',
            {'capacite': 25},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_delete_bus_en_voyage_refuse(self):
        bus = make_bus(self.agence, etat=StatusBus.EN_VOYAGE)
        response = self.client_ml.delete(f'/api/bus/{bus.IdBus}/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_delete_bus_disponible(self):
        bus = make_bus(self.agence)
        response = self.client_ml.delete(f'/api/bus/{bus.IdBus}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

    @patch('fleet.views.publish_bus_status_changed', return_value=True)
    @patch('fleet.views.publish_bus_updated_for_booking', return_value=True)
    def test_changer_statut_bus(self, *mocks):
        bus = make_bus(self.agence)
        response = self.client_ml.put(
            f'/api/bus/{bus.IdBus}/etat/',
            {'etat': 'en_panne', 'raison': 'Panne moteur'},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        bus.refresh_from_db()
        self.assertEqual(bus.etat, StatusBus.EN_PANNE)

    @patch('fleet.views.publish_bus_status_changed', return_value=True)
    @patch('fleet.views.publish_bus_breakdown', return_value=True)
    @patch('fleet.views.publish_bus_updated_for_booking', return_value=True)
    def test_changer_statut_bus_en_panne_envoie_breakdown(self, *mocks):
        bus = make_bus(self.agence)
        response = self.client_ml.put(
            f'/api/bus/{bus.IdBus}/etat/',
            {'etat': 'en_panne', 'raison': 'Freins défectueux'},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_changer_statut_bus_invalide(self):
        bus = make_bus(self.agence)
        response = self.client_ml.put(
            f'/api/bus/{bus.IdBus}/etat/',
            {'etat': 'volant'},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_changer_statut_meme_etat(self):
        bus = make_bus(self.agence)
        response = self.client_ml.put(
            f'/api/bus/{bus.IdBus}/etat/',
            {'etat': 'disponible'},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_bus_disponibles(self):
        make_bus(self.agence, immatriculation='DISP01')
        make_bus(self.agence, immatriculation='PANNE01', etat=StatusBus.EN_PANNE)
        response = self.client_anon.get('/api/bus/disponibles/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data.get('results', response.data)
        for b in results:
            self.assertEqual(b['etat'], 'disponible')


# ─────────────────────────────────────────────────────────────────────────────
# CHAUFFEURS
# ─────────────────────────────────────────────────────────────────────────────

class ChauffeurAPITest(TestCase):

    def setUp(self):
        self.agence   = make_agence()
        self.filiale  = make_filiale(self.agence)
        self.client_ml = AuthenticatedClient(
            role='MANAGER_LOCAL',
            agence_id=self.agence.id_agence,
            filiale_id=self.filiale.id_filiale,
        )

    @patch('fleet.views.publish_staff_created', return_value=True)
    def test_create_chauffeur(self, *mocks):
        data = {
            'numero_permis': 'PNEW001',
            'name': 'Jean',
            'surname': 'Mbarga',
            'email': 'jean@express.cm',
            'phone': '699000020',
            'Adresse': 'Douala',
            'Id_agence': self.agence.id_agence,
            'date_embauche': '2024-01-01',
        }
        response = self.client_ml.post('/api/chauffeurs/', data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_list_chauffeurs_public(self):
        make_chauffeur(self.agence)
        response = APIClient().get('/api/chauffeurs/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_get_chauffeur_public(self):
        ch = make_chauffeur(self.agence)
        response = APIClient().get(f'/api/chauffeurs/{ch.id_chauffeur}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_delete_chauffeur_avec_voyage_programme_refuse(self):
        filiale2 = make_filiale(
            self.agence, code='YDE', ville='Yaoundé', email='yde@exp.cm'
        )
        ch      = make_chauffeur(self.agence)
        bus     = make_bus(self.agence, immatriculation='BVOYAGE')
        trajet  = make_trajet(self.filiale, filiale2)
        make_voyage(trajet, bus, ch)
        response = self.client_ml.delete(f'/api/chauffeurs/{ch.id_chauffeur}/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_changer_disponibilite_chauffeur(self):
        ch = make_chauffeur(self.agence)
        response = self.client_ml.put(
            f'/api/chauffeurs/{ch.id_chauffeur}/disponibilite/',
            {'est_disponible': False},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ch.refresh_from_db()
        self.assertFalse(ch.est_disponible)

    def test_changer_disponibilite_sans_champ_refuse(self):
        ch = make_chauffeur(self.agence)
        response = self.client_ml.put(
            f'/api/chauffeurs/{ch.id_chauffeur}/disponibilite/',
            {},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


# ─────────────────────────────────────────────────────────────────────────────
# GUICHETIERS
# ─────────────────────────────────────────────────────────────────────────────

class GuichetierAPITest(TestCase):

    def setUp(self):
        self.agence  = make_agence()
        self.filiale = make_filiale(self.agence)
        self.client_ml = AuthenticatedClient(
            role='MANAGER_LOCAL',
            agence_id=self.agence.id_agence,
            filiale_id=self.filiale.id_filiale,
        )

    @patch('fleet.views.publish_staff_created', return_value=True)
    def test_create_guichetier(self, *mocks):
        data = {
            'name': 'Marie', 'surname': 'Essonba',
            'email': 'marie@express.cm', 'phone': '699000030',
            'adresse': 'Douala', 'password': 'TempPass123!',
            '_id_filiale': str(self.filiale.id_filiale),
        }
        response = self.client_ml.post('/api/guichetiers/', data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_list_guichetiers_manager_local(self):
        response = self.client_ml.get('/api/guichetiers/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_list_guichetiers_public_refuse(self):
        response = APIClient().get('/api/guichetiers/')
        self.assertIn(response.status_code, [
            status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN
        ])


# ─────────────────────────────────────────────────────────────────────────────
# TRAJETS
# ─────────────────────────────────────────────────────────────────────────────

class TrajetAPITest(TestCase):

    def setUp(self):
        self.agence   = make_agence()
        self.filiale1 = make_filiale(self.agence, code='DLA', ville='Douala')
        self.filiale2 = make_filiale(
            self.agence, code='YDE', ville='Yaoundé', email='yde@exp.cm'
        )
        self.client_mg   = AuthenticatedClient(
            role='MANAGER_GLOBAL', agence_id=self.agence.id_agence
        )
        self.client_anon = APIClient()

    def test_create_trajet_manager_global(self):
        data = {
            'filiale_depart': str(self.filiale1.id_filiale),
            'filiale_arrive': str(self.filiale2.id_filiale),
            'distance': 300.5,
        }
        response = self.client_mg.post('/api/trajets/', data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_list_trajets_public(self):
        make_trajet(self.filiale1, self.filiale2)
        response = self.client_anon.get('/api/trajets/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_get_trajet_public(self):
        t = make_trajet(self.filiale1, self.filiale2)
        response = self.client_anon.get(f'/api/trajets/{t.Id_trajet}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_delete_trajet_avec_voyages_refuse(self):
        t   = make_trajet(self.filiale1, self.filiale2)
        bus = make_bus(self.agence)
        make_voyage(t, bus)
        response = self.client_mg.delete(f'/api/trajets/{t.Id_trajet}/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_filtrage_par_depart(self):
        make_trajet(self.filiale1, self.filiale2)
        response = self.client_anon.get('/api/trajets/?depart=Douala')
        self.assertEqual(response.status_code, status.HTTP_200_OK)


# ─────────────────────────────────────────────────────────────────────────────
# VOYAGES
# ─────────────────────────────────────────────────────────────────────────────

class VoyageAPITest(TestCase):

    def setUp(self):
        self.agence   = make_agence()
        self.filiale1 = make_filiale(self.agence, code='DLA', ville='Douala')
        self.filiale2 = make_filiale(
            self.agence, code='YDE', ville='Yaoundé', email='yde@exp.cm'
        )
        self.bus      = make_bus(self.agence)
        self.chauffeur = make_chauffeur(self.agence)
        self.trajet   = make_trajet(self.filiale1, self.filiale2)
        self.client_ml = AuthenticatedClient(
            role='MANAGER_LOCAL',
            agence_id=self.agence.id_agence,
            filiale_id=self.filiale1.id_filiale,
        )
        self.client_anon = APIClient()

    @patch('fleet.views.publish_bus_updated_for_booking', return_value=True)
    @patch('fleet.views.publish_voyage_updated_for_booking', return_value=True)
    def test_create_voyage(self, *mocks):
        now = timezone.now()
        data = {
            'date_heure_depart': (now + timezone.timedelta(hours=3)).isoformat(),
            'date_heure_arrive_prevue': (now + timezone.timedelta(hours=8)).isoformat(),
            'prix': '5000.00',
            'type_voyage': 'standard',
            'status': 'programme',
            'places_disponibles': 30,
            'IdBus': self.bus.IdBus,
            'Id_trajet': str(self.trajet.Id_trajet),
        }
        response = self.client_ml.post('/api/voyages/', data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_list_voyages_public(self):
        make_voyage(self.trajet, self.bus)
        response = self.client_anon.get('/api/voyages/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_get_voyage_public(self):
        v = make_voyage(self.trajet, self.bus)
        response = self.client_anon.get(f'/api/voyages/{v.Id_voyage}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('idAgence', response.data)
        self.assertIn('idFiliale', response.data)
        self.assertIn('origine', response.data)
        self.assertIn('destination', response.data)

    @patch('fleet.views.publish_voyage_cancelled', return_value=True)
    @patch('fleet.views.publish_bus_updated_for_booking', return_value=True)
    @patch('fleet.views.publish_voyage_updated_for_booking', return_value=True)
    def test_changer_statut_voyage_annule(self, *mocks):
        v = make_voyage(self.trajet, self.bus)
        response = self.client_ml.put(
            f'/api/voyages/{v.Id_voyage}/statut/',
            {'status': 'annule', 'motif': 'Problème technique'},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        v.refresh_from_db()
        self.assertEqual(v.status, StatusVoyage.ANNULE)

    @patch('fleet.views.publish_voyage_departed', return_value=True)
    @patch('fleet.views.publish_voyage_updated_for_booking', return_value=True)
    def test_changer_statut_voyage_en_cours(self, *mocks):
        v = make_voyage(self.trajet, self.bus)
        response = self.client_ml.put(
            f'/api/voyages/{v.Id_voyage}/statut/',
            {'status': 'en_cours'},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_changer_statut_invalide(self):
        v = make_voyage(self.trajet, self.bus)
        response = self.client_ml.put(
            f'/api/voyages/{v.Id_voyage}/statut/',
            {'status': 'inexistant'},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_delete_voyage_en_cours_refuse(self):
        v = make_voyage(self.trajet, self.bus, status=StatusVoyage.EN_COURS)
        response = self.client_ml.delete(f'/api/voyages/{v.Id_voyage}/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @patch('fleet.views.publish_bus_updated_for_booking', return_value=True)
    def test_delete_voyage_libere_bus(self, *mocks):
        self.bus.etat = StatusBus.EN_VOYAGE
        self.bus.save()
        v = make_voyage(self.trajet, self.bus)
        response = self.client_ml.delete(f'/api/voyages/{v.Id_voyage}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.bus.refresh_from_db()
        self.assertEqual(self.bus.etat, StatusBus.DISPONIBLE)

    def test_recherche_voyages_public(self):
        make_voyage(self.trajet, self.bus)
        response = self.client_anon.get(
            '/api/voyages/recherche/?depart=Douala&arrivee=Yaoundé'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    @patch('fleet.views.publish_bus_updated_for_booking', return_value=True)
    @patch('fleet.views.publish_voyage_updated_for_booking', return_value=True)
    def test_assigner_bus_voyage(self, *mocks):
        bus2 = make_bus(self.agence, immatriculation='NEWBUS01')
        v    = make_voyage(self.trajet, self.bus)
        response = self.client_ml.post(
            f'/api/voyages/{v.Id_voyage}/assigner-bus/',
            {'bus_id': bus2.IdBus},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_assigner_bus_non_disponible_refuse(self):
        bus2 = make_bus(self.agence, immatriculation='BUSENPANNE', etat=StatusBus.EN_PANNE)
        v    = make_voyage(self.trajet, self.bus)
        response = self.client_ml.post(
            f'/api/voyages/{v.Id_voyage}/assigner-bus/',
            {'bus_id': bus2.IdBus},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @patch('fleet.views.publish_voyage_updated_for_booking', return_value=True)
    def test_assigner_chauffeur_voyage(self, *mocks):
        v = make_voyage(self.trajet, self.bus)
        response = self.client_ml.post(
            f'/api/voyages/{v.Id_voyage}/assigner-chauffeur/',
            {'chauffeur_id': str(self.chauffeur.id_chauffeur)},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.chauffeur.refresh_from_db()
        self.assertFalse(self.chauffeur.est_disponible)

    def test_assigner_chauffeur_indisponible_refuse(self):
        self.chauffeur.est_disponible = False
        self.chauffeur.save()
        v = make_voyage(self.trajet, self.bus)
        response = self.client_ml.post(
            f'/api/voyages/{v.Id_voyage}/assigner-chauffeur/',
            {'chauffeur_id': str(self.chauffeur.id_chauffeur)},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


# ─────────────────────────────────────────────────────────────────────────────
# ANNONCES
# ─────────────────────────────────────────────────────────────────────────────

class AnnonceAPITest(TestCase):

    def setUp(self):
        self.agence  = make_agence()
        self.filiale1 = make_filiale(self.agence, code='DLA', ville='Douala')
        self.filiale2 = make_filiale(
            self.agence, code='YDE', ville='Yaoundé', email='yde@exp.cm'
        )
        self.bus     = make_bus(self.agence)
        self.trajet  = make_trajet(self.filiale1, self.filiale2)
        self.voyage  = make_voyage(self.trajet, self.bus)
        self.client_ml   = AuthenticatedClient(
            role='MANAGER_LOCAL',
            agence_id=self.agence.id_agence,
            filiale_id=self.filiale1.id_filiale,
        )
        self.client_anon = APIClient()

    @patch('fleet.views.publish_annonce_published', return_value=True)
    def test_create_annonce(self, *mocks):
        data = {
            'type': 'information',
            'message': 'Voyage maintenu.',
            'Id_voyage': str(self.voyage.Id_voyage),
        }
        response = self.client_ml.post('/api/annonces/', data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_list_annonces_public(self):
        Annonce.objects.create(
            type=TypeAnnonce.INFORMATION, message='Test.', Id_voyage=self.voyage
        )
        response = self.client_anon.get('/api/annonces/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_get_annonce(self):
        a = Annonce.objects.create(
            type=TypeAnnonce.RETARD, message='Retard.', Id_voyage=self.voyage
        )
        response = self.client_anon.get(f'/api/annonces/{a.id_annonce}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_filtrage_annonce_par_voyage(self):
        Annonce.objects.create(
            type=TypeAnnonce.INFORMATION, message='Test.', Id_voyage=self.voyage
        )
        response = self.client_anon.get(
            f'/api/annonces/?voyage_id={self.voyage.Id_voyage}'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)


# ─────────────────────────────────────────────────────────────────────────────
# AVIS
# ─────────────────────────────────────────────────────────────────────────────

class AvisAPITest(TestCase):

    def setUp(self):
        self.agence   = make_agence()
        self.filiale1 = make_filiale(self.agence, code='DLA', ville='Douala')
        self.filiale2 = make_filiale(
            self.agence, code='YDE', ville='Yaoundé', email='yde@exp.cm'
        )
        self.bus      = make_bus(self.agence)
        self.trajet   = make_trajet(self.filiale1, self.filiale2)
        self.voyage   = make_voyage(self.trajet, self.bus)
        self.user_id  = uuid.uuid4()
        self.client_voyageur = AuthenticatedClient(
            role='VOYAGEUR', user_id=self.user_id
        )
        self.client_anon = APIClient()

    def test_create_avis_voyageur(self):
        data = {
            'note': 5,
            'commentaires': 'Excellent voyage !',
            'Id_voyage': str(self.voyage.Id_voyage),
            'user_id': str(self.user_id),
        }
        response = self.client_voyageur.post('/api/avis/', data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_create_avis_non_voyageur_refuse(self):
        client_ml = AuthenticatedClient(role='MANAGER_LOCAL')
        data = {
            'note': 3, 'commentaires': 'Bof.',
            'Id_voyage': str(self.voyage.Id_voyage),
        }
        response = client_ml.post('/api/avis/', data)
        self.assertIn(response.status_code, [
            status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN
        ])

    def test_list_avis_public(self):
        Avis.objects.create(
            note=4, commentaires='Bien.', Id_voyage=self.voyage,
            user_id=self.user_id, est_approuve=True,
        )
        response = self.client_anon.get('/api/avis/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_stats_avis_voyage(self):
        Avis.objects.create(
            note=5, commentaires='Super.', Id_voyage=self.voyage,
            user_id=self.user_id, est_approuve=True,
        )
        response = self.client_anon.get(
            f'/api/avis/voyage/{self.voyage.Id_voyage}/stats/'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('note_moyenne', response.data)
        self.assertIn('repartition', response.data)


# ─────────────────────────────────────────────────────────────────────────────
# PROFIL PUBLIC AGENCE
# ─────────────────────────────────────────────────────────────────────────────

class AgenceProfilPublicAPITest(TestCase):

    def setUp(self):
        self.agence   = make_agence()
        self.filiale1 = make_filiale(self.agence, code='DLA', ville='Douala')
        self.filiale2 = make_filiale(
            self.agence, code='YDE', ville='Yaoundé', email='yde@exp.cm'
        )
        self.bus      = make_bus(self.agence)
        self.trajet   = make_trajet(self.filiale1, self.filiale2)
        self.voyage   = make_voyage(self.trajet, self.bus)

    def test_profil_public(self):
        response = APIClient().get(
            f'/api/agences/{self.agence.id_agence}/profil/'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data
        self.assertIn('agence',   data)
        self.assertIn('filiales', data)
        self.assertIn('bus',      data)
        self.assertIn('trajets',  data)
        self.assertIn('voyages',  data)
        self.assertIn('avis',     data)
        self.assertIn('resume',   data)

    def test_profil_agence_inexistante(self):
        response = APIClient().get(f'/api/agences/{uuid.uuid4()}/profil/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_profil_filtrage_statut_voyage(self):
        response = APIClient().get(
            f'/api/agences/{self.agence.id_agence}/profil/?statut_voyage=programme'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        for v in response.data['voyages']:
            self.assertEqual(v['status'], 'programme')


# ─────────────────────────────────────────────────────────────────────────────
# HEALTH CHECK
# ─────────────────────────────────────────────────────────────────────────────

class HealthCheckAPITest(TestCase):

    def test_health_check(self):
        response = APIClient().get('/api/health/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'healthy')
        self.assertEqual(response.data['service'], 'fleet-management-service')


# ─────────────────────────────────────────────────────────────────────────────
# MIDDLEWARE JWT — chemins publics vs protégés
# ─────────────────────────────────────────────────────────────────────────────

class MiddlewareJWTTest(TestCase):

    def test_get_agences_sans_token(self):
        """GET /api/agences/ est public — doit répondre 200 sans token."""
        response = APIClient().get('/api/agences/')
        self.assertNotEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_post_agences_sans_token(self):
        """POST /api/agences/ exige un token."""
        response = APIClient().post('/api/agences/', {})
        self.assertIn(response.status_code, [
            status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN
        ])

    def test_health_sans_token(self):
        response = APIClient().get('/api/health/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    @patch('fleet.middleware.requests.post')
    def test_token_invalide_retourne_401(self, mock_post):
        mock_response = MagicMock()
        mock_response.status_code = 401
        mock_response.text = 'Unauthorized'
        mock_post.return_value = mock_response

        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION='Bearer invalid-token')
        response = client.post('/api/agences/', {'name': 'Test'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    @patch('fleet.middleware.requests.post')
    def test_auth_service_indisponible_retourne_503(self, mock_post):
        import requests as req_lib
        mock_post.side_effect = req_lib.exceptions.ConnectionError()

        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION='Bearer any-token')
        response = client.post('/api/agences/', {'name': 'Test'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)