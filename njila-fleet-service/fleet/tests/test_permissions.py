# fleet/tests/test_permissions.py
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from unittest.mock import patch, MagicMock
import uuid
from django.utils import timezone
from datetime import timedelta

from fleet.models import (
    Agence, Bus, Voyage, Trajet, Filiale, 
    StatusBus, StatusVoyage, StatutGlobalAgence
)


class PermissionTest(TestCase):
    """Tests des permissions RBAC"""
    
    def setUp(self):
        self.client = APIClient()
        
        # Créer des données de test
        self.agence = Agence.objects.create(
            name='Test Agence',
            adresse='Douala',
            telephone='677777777',
            email_officiel='test@agence.com',
            statut_global=StatutGlobalAgence.ACTIVE
        )
        
        self.filiale = Filiale.objects.create(
            agence=self.agence,
            nom='Test Filiale',
            code='TEST',
            ville='Douala',
            adresse='Test Adresse',
            telephone='677777778',
            email='test@filiale.com'
        )
        
        self.bus = Bus.objects.create(
            modele='Coaster',
            immatriculation='LT123AB',
            capacite=45,
            etat=StatusBus.DISPONIBLE,
            Id_agence=self.agence
        )
        
        self.trajet = Trajet.objects.create(
            filiale_depart=self.filiale,
            filiale_arrive=self.filiale,
            distance=100
        )
        
        self.voyage = Voyage.objects.create(
            date_heure_depart=timezone.now() + timedelta(days=1),
            date_heure_arrive_prevue=timezone.now() + timedelta(days=1, hours=4),
            prix=5000,
            type_voyage='standard',
            places_disponibles=45,
            IdBus=self.bus,
            Id_trajet=self.trajet,
            status=StatusVoyage.PROGRAMME
        )
    
    def _get_mock_response(self, role, agence_id=None, filiale_id=None):
        """Crée une réponse mock pour auth-service"""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'userId': str(uuid.uuid4()),
            'role': role,
            'agence_id': str(agence_id or self.agence.id_agence),
            'filiale_id': str(filiale_id or self.filiale.id_filiale)
        }
        return mock_response
    
    # ============ TESTS ACCÈS PUBLIC ============
    
    def test_public_access_to_agences(self):
        """Test accès public à la liste des agences"""
        response = self.client.get('/api/agences/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
    
    def test_public_access_to_agence_detail(self):
        """Test accès public au détail d'une agence"""
        response = self.client.get(f'/api/agences/{self.agence.id_agence}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
    
    def test_public_access_to_health(self):
        """Test accès public au health check"""
        response = self.client.get('/api/health/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
    
    def test_public_access_to_voyages_list(self):
        """Test accès public à la liste des voyages"""
        response = self.client.get('/api/voyages/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
    
    def test_public_access_to_voyages_search(self):
        """Test accès public à la recherche de voyages"""
        response = self.client.get('/api/voyages/recherche/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
    
    def test_public_access_to_trajets(self):
        """Test accès public à la liste des trajets"""
        response = self.client.get('/api/trajets/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
    
    def test_public_access_to_annonces(self):
        """Test accès public à la liste des annonces"""
        response = self.client.get('/api/annonces/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
    
    def test_public_access_to_avis(self):
        """Test accès public à la liste des avis"""
        response = self.client.get('/api/avis/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
    
    # ============ TESTS ENDPOINTS PROTÉGÉS SANS TOKEN ============
    
    def test_unauthenticated_cannot_create_bus(self):
        """Test qu'un utilisateur non authentifié ne peut pas créer un bus"""
        response = self.client.post('/api/bus/', {
            'modele': 'Coaster',
            'immatriculation': 'LT999ZZ',
            'capacite': 45,
            'Id_agence': str(self.agence.id_agence)
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
    
    def test_unauthenticated_cannot_create_voyage(self):
        """Test qu'un utilisateur non authentifié ne peut pas créer un voyage"""
        response = self.client.post('/api/voyages/', {
            'date_heure_depart': (timezone.now() + timedelta(days=2)).isoformat(),
            'date_heure_arrive_prevue': (timezone.now() + timedelta(days=2, hours=4)).isoformat(),
            'prix': 5000,
            'places_disponibles': 45,
            'IdBus': self.bus.IdBus,
            'Id_trajet': str(self.trajet.Id_trajet)
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
    
    def test_unauthenticated_cannot_create_agence(self):
        """Test qu'un utilisateur non authentifié ne peut pas créer une agence"""
        response = self.client.post('/api/agences/', {
            'name': 'Nouvelle Agence',
            'adresse': 'Yaoundé',
            'telephone': '688888888',
            'email_officiel': 'nouvelle@agence.com'
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
    
    # ============ TESTS AVEC AUTHENTIFICATION ============
    
    @patch('fleet.middleware.requests.post')
    def test_admin_can_create_agence(self, mock_post):
        """Test qu'un admin peut créer une agence"""
        mock_post.return_value = self._get_mock_response('ADMINISTRATEUR')
        
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake_token')
        response = self.client.post('/api/agences/', {
            'name': 'Nouvelle Agence',
            'adresse': 'Yaoundé',
            'telephone': '688888888',
            'email_officiel': 'nouvelle@agence.com'
        }, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
    
    @patch('fleet.middleware.requests.post')
    def test_voyageur_cannot_create_agence(self, mock_post):
        """Test qu'un voyageur ne peut pas créer une agence"""
        mock_post.return_value = self._get_mock_response('VOYAGEUR')
        
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake_token')
        response = self.client.post('/api/agences/', {
            'name': 'Nouvelle Agence',
            'adresse': 'Yaoundé',
            'telephone': '688888888',
            'email_officiel': 'nouvelle@agence.com'
        }, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
    
   
    
    @patch('fleet.middleware.requests.post')
    def test_manager_local_can_create_bus(self, mock_post):
        """Test qu'un manager local peut créer un bus"""
        mock_post.return_value = self._get_mock_response('MANAGER_LOCAL')
        
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake_token')
        response = self.client.post('/api/bus/', {
            'modele': 'Coaster',
            'immatriculation': 'LT999ZZ',
            'capacite': 45,
            'Id_agence': str(self.agence.id_agence)
        }, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
    

@patch('fleet.permissions.requests.post')
def test_manager_local_can_update_bus(self, mock_post):
    """Test qu'un manager local peut modifier un bus"""
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        'userId': str(uuid.uuid4()),
        'role': 'MANAGER_LOCAL',
        'agence_id': str(self.agence.id_agence),
        'filiale_id': str(self.filiale.id_filiale)
    }
    mock_post.return_value = mock_response
    
    # Créer un token valide
    self.client.credentials(HTTP_AUTHORIZATION='Bearer valid_token')
    
    # Mettre à jour le bus (PUT)
    response = self.client.put(f'/api/bus/{self.bus.IdBus}/', {
        'modele': 'Coaster Luxe',
        'immatriculation': self.bus.immatriculation,
        'capacite': self.bus.capacite,
        'etat': self.bus.etat,
        'Id_agence': str(self.agence.id_agence)
    }, format='json')
    
    self.assertEqual(response.status_code, status.HTTP_200_OK)


@patch('fleet.permissions.requests.post')
def test_voyageur_can_create_avis(self, mock_post):
    """Test qu'un voyageur peut laisser un avis"""
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        'userId': str(uuid.uuid4()),
        'role': 'VOYAGEUR',
        'agence_id': str(self.agence.id_agence),
        'filiale_id': str(self.filiale.id_filiale)
    }
    mock_post.return_value = mock_response
    
    self.client.credentials(HTTP_AUTHORIZATION='Bearer valid_token')
    response = self.client.post('/api/avis/', {
        'note': 4,
        'commentaires': 'Très bon voyage',
        'Id_voyage': str(self.voyage.Id_voyage)
    }, format='json')
    
    # Vérifier le code d'erreur pour debug
    if response.status_code != 201:
        print(f"Response content: {response.content}")
    
    self.assertEqual(response.status_code, status.HTTP_201_CREATED)
    
    @patch('fleet.middleware.requests.post')
    def test_voyageur_cannot_create_bus(self, mock_post):
        """Test qu'un voyageur ne peut pas créer un bus"""
        mock_post.return_value = self._get_mock_response('VOYAGEUR')
        
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake_token')
        response = self.client.post('/api/bus/', {
            'modele': 'Coaster',
            'immatriculation': 'LT999ZZ',
            'capacite': 45,
            'Id_agence': str(self.agence.id_agence)
        }, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
    
    @patch('fleet.middleware.requests.post')
    def test_manager_global_can_create_filiale(self, mock_post):
        """Test qu'un manager global peut créer une filiale"""
        mock_post.return_value = self._get_mock_response('MANAGER_GLOBAL')
        
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake_token')
        response = self.client.post('/api/filiales/', {
            'agence': str(self.agence.id_agence),
            'nom': 'Nouvelle Filiale',
            'code': 'NEW',
            'ville': 'Douala',
            'adresse': 'Adresse',
            'telephone': '677777777',
            'email': 'new@filiale.com'
        }, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
    
    @patch('fleet.middleware.requests.post')
    def test_voyageur_cannot_create_filiale(self, mock_post):
        """Test qu'un voyageur ne peut pas créer une filiale"""
        mock_post.return_value = self._get_mock_response('VOYAGEUR')
        
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake_token')
        response = self.client.post('/api/filiales/', {
            'agence': str(self.agence.id_agence),
            'nom': 'Nouvelle Filiale',
            'code': 'NEW',
            'ville': 'Douala',
            'adresse': 'Adresse',
            'telephone': '677777777',
            'email': 'new@filiale.com'
        }, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
    
    @patch('fleet.middleware.requests.post')
    def test_manager_local_can_program_voyage(self, mock_post):
        """Test qu'un manager local peut programmer un voyage"""
        mock_post.return_value = self._get_mock_response('MANAGER_LOCAL')
        
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake_token')
        response = self.client.post('/api/voyages/', {
            'date_heure_depart': (timezone.now() + timedelta(days=3)).isoformat(),
            'date_heure_arrive_prevue': (timezone.now() + timedelta(days=3, hours=4)).isoformat(),
            'prix': 6000,
            'places_disponibles': 45,
            'IdBus': self.bus.IdBus,
            'Id_trajet': str(self.trajet.Id_trajet)
        }, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
    
    @patch('fleet.middleware.requests.post')
    def test_voyageur_cannot_program_voyage(self, mock_post):
        """Test qu'un voyageur ne peut pas programmer un voyage"""
        mock_post.return_value = self._get_mock_response('VOYAGEUR')
        
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake_token')
        response = self.client.post('/api/voyages/', {
            'date_heure_depart': (timezone.now() + timedelta(days=3)).isoformat(),
            'date_heure_arrive_prevue': (timezone.now() + timedelta(days=3, hours=4)).isoformat(),
            'prix': 6000,
            'places_disponibles': 45,
            'IdBus': self.bus.IdBus,
            'Id_trajet': str(self.trajet.Id_trajet)
        }, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)