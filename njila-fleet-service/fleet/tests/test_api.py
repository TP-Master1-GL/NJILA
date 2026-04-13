import uuid
import io
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status
from unittest.mock import patch, MagicMock
from datetime import datetime, timedelta

from fleet.models import (
    Agence, Filiale, Bus, Chauffeur, Guichetier, 
    Trajet, Voyage, Annonce, Avis,
    StatusBus, StatusVoyage, StatutGlobalAgence, TypeAnnonce
)


class AuthenticatedAPITest(TestCase):
    """
    Classe de base pour les tests avec authentification
    """
    
    def setUp(self):
        self.client = APIClient()
        self.auth_patcher = None
    
    def _set_auth_mock(self, role, agence_id=None, filiale_id=None):
        """Configure le mock pour l'authentification"""
        # Arrêter un éventuel patcher existant
        if self.auth_patcher:
            self.auth_patcher.stop()
        
        # Mocker requests.post globalement (couvre middleware et permissions)
        self.auth_patcher = patch('requests.post')
        self.mock_auth = self.auth_patcher.start()
        self.addCleanup(self.auth_patcher.stop)
        
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'userId': str(uuid.uuid4()),
            'role': role,
            'agence_id': str(agence_id) if agence_id else str(uuid.uuid4()),
            'filiale_id': str(filiale_id) if filiale_id else str(uuid.uuid4())
        }
        self.mock_auth.return_value = mock_response
        self.client.credentials(HTTP_AUTHORIZATION='Bearer valid_token')
    
    def _clear_auth(self):
        """Supprime les credentials pour les tests publics"""
        if self.auth_patcher:
            self.auth_patcher.stop()
            self.auth_patcher = None
        self.client.credentials()


class AgenceAPITest(AuthenticatedAPITest):
    """Tests des endpoints API pour les agences"""
    
    def setUp(self):
        super().setUp()
        self.agence_data = {
            'name': 'General Voyages',
            'adresse': 'Bld de la Liberté, Douala',
            'telephone': '677777777',
            'email_officiel': 'contact@generalvoyages.cm',
            'statut_global': StatutGlobalAgence.ACTIVE,
        }
    
    @patch('fleet.views.publish_agence_created')
    @patch('fleet.views.publish_agence_subscription_request')
    def test_create_agence(self, mock_subscription, mock_agence_created):
        """Test création d'une agence via API (Admin uniquement)"""
        self._set_auth_mock('ADMINISTRATEUR')
        
        url = reverse('agence-list-create')
        response = self.client.post(url, self.agence_data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['name'], 'General Voyages')
        self.assertEqual(response.data['email_officiel'], 'contact@generalvoyages.cm')
        
        mock_agence_created.assert_called_once()
        mock_subscription.assert_called_once()
    
    def test_create_agence_duplicate_email(self):
        """Test création avec email dupliqué (Admin requis)"""
        Agence.objects.create(**self.agence_data)
        self._set_auth_mock('ADMINISTRATEUR')
        
        url = reverse('agence-list-create')
        response = self.client.post(url, self.agence_data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('email_officiel', response.data)
    
    def test_list_agences(self):
        """Test liste des agences (public - pas de token requis)"""
        self._clear_auth()
        Agence.objects.create(**self.agence_data)
        
        url = reverse('agence-list-create')
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['name'], 'General Voyages')
    
    def test_list_agences_filter_by_status(self):
        """Test liste avec filtre statut (public)"""
        self._clear_auth()
        Agence.objects.create(**self.agence_data)
        Agence.objects.create(
            name='Binam',
            adresse='Rue du Commerce, Douala',
            telephone='688888888',
            email_officiel='contact@binam.cm',
            statut_global=StatutGlobalAgence.SUSPENDUE
        )
        
        url = reverse('agence-list-create')
        response = self.client.get(url, {'statut_global': 'active'})
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['name'], 'General Voyages')
    
    def test_list_agences_search(self):
        """Test recherche d'agences (public)"""
        self._clear_auth()
        Agence.objects.create(**self.agence_data)
        Agence.objects.create(
            name='Binam Transport',
            adresse='Rue du Commerce, Douala',
            telephone='688888888',
            email_officiel='contact@binam.cm'
        )
        
        url = reverse('agence-list-create')
        response = self.client.get(url, {'search': 'General'})
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['name'], 'General Voyages')
    
    @patch('fleet.views.publish_agence_updated')
    def test_update_agence(self, mock_agence_updated):
        """Test mise à jour d'une agence (Admin uniquement)"""
        agence = Agence.objects.create(**self.agence_data)
        self._set_auth_mock('ADMINISTRATEUR', agence_id=agence.id_agence)
        
        url = reverse('agence-detail', args=[agence.id_agence])
        response = self.client.patch(
            url, 
            {'name': 'General Voyages Updated', 'telephone': '699999999'},
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['name'], 'General Voyages Updated')
        self.assertEqual(response.data['telephone'], '699999999')
        mock_agence_updated.assert_called_once()
    
    def test_get_agence_detail(self):
        """Test détail d'une agence (public)"""
        self._clear_auth()
        agence = Agence.objects.create(**self.agence_data)
        
        url = reverse('agence-detail', args=[agence.id_agence])
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['name'], 'General Voyages')
        self.assertEqual(response.data['adresse'], 'Bld de la Liberté, Douala')
    
    def test_delete_agence(self):
        """Test suppression d'une agence (Admin uniquement)"""
        agence = Agence.objects.create(**self.agence_data)
        self._set_auth_mock('ADMINISTRATEUR', agence_id=agence.id_agence)
        
        url = reverse('agence-detail', args=[agence.id_agence])
        response = self.client.delete(url)
        
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(Agence.objects.count(), 0)
    
    def test_delete_agence_with_bus_fails(self):
        """Test suppression d'une agence avec bus (doit échouer)"""
        agence = Agence.objects.create(**self.agence_data)
        Bus.objects.create(
            modele='Coaster',
            immatriculation='LT123AB',
            capacite=45,
            Id_agence=agence
        )
        self._set_auth_mock('ADMINISTRATEUR', agence_id=agence.id_agence)
        
        url = reverse('agence-detail', args=[agence.id_agence])
        response = self.client.delete(url)
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)
        self.assertEqual(Agence.objects.count(), 1)


class FilialeAPITest(AuthenticatedAPITest):
    """Tests des endpoints API pour les filiales"""
    
    def setUp(self):
        super().setUp()
        self.agence = Agence.objects.create(
            name='General Voyages',
            adresse='Bld de la Liberté, Douala',
            telephone='677777777',
            email_officiel='contact@generalvoyages.cm'
        )
        self.filiale = None
        
        self.filiale_data = {
            'agence': self.agence.id_agence,
            'nom': 'General Voyages Douala',
            'code': 'GV-DLA',
            'ville': 'Douala',
            'adresse': 'Bld de la Liberté',
            'telephone': '677777778',
            'email': 'douala@generalvoyages.cm'
        }
    
    @patch('fleet.views.publish_filiale_created')
    def test_create_filiale(self, mock_filiale_created):
        """Test création d'une filiale via API (Manager Global)"""
        self._set_auth_mock('MANAGER_GLOBAL', agence_id=self.agence.id_agence)
        
        url = reverse('filiale-list-create')
        response = self.client.post(url, self.filiale_data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['nom'], 'General Voyages Douala')
        self.assertEqual(response.data['ville'], 'Douala')
        mock_filiale_created.assert_called_once()
    
    def test_list_filiales(self):
        """Test liste des filiales (public)"""
        self._clear_auth()
        self.filiale = Filiale.objects.create(
            agence=self.agence,
            nom='General Voyages Douala',
            code='GV-DLA',
            ville='Douala',
            adresse='Bld de la Liberté',
            telephone='677777778',
            email='douala@generalvoyages.cm'
        )
        
        url = reverse('filiale-list-create')
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['nom'], 'General Voyages Douala')
    
    def test_filiale_stats(self):
        """Test statistiques d'une filiale (public)"""
        self._clear_auth()
        self.filiale = Filiale.objects.create(
            agence=self.agence,
            nom='General Voyages Douala',
            code='GV-DLA',
            ville='Douala',
            adresse='Bld de la Liberté',
            telephone='677777778',
            email='douala@generalvoyages.cm'
        )
        
        Bus.objects.create(
            modele='Coaster',
            immatriculation='LT123AB',
            capacite=45,
            Id_agence=self.agence
        )
        
        url = reverse('filiale-stats', args=[self.filiale.id_filiale])
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['filiale']['nom'], 'General Voyages Douala')
        self.assertIn('bus_stats', response.data)


class BusAPITest(AuthenticatedAPITest):
    """Tests des endpoints API pour les bus"""
    
    def setUp(self):
        super().setUp()
        self.agence = Agence.objects.create(
            name='General Voyages',
            adresse='Bld de la Liberté, Douala',
            telephone='677777777',
            email_officiel='contact@generalvoyages.cm'
        )
        
        self.bus_data = {
            'modele': 'Coaster',
            'immatriculation': 'LT123AB',
            'capacite': 45,
            'etat': StatusBus.DISPONIBLE,
            'Id_agence': self.agence  
        }
    
    def test_create_bus(self):
        """Test création d'un bus via API (Manager Local)"""
        api_bus_data = {
            'modele': 'Coaster',
            'immatriculation': 'LT123AB',
            'capacite': 45,
            'etat': StatusBus.DISPONIBLE,
            'Id_agence': self.agence.id_agence  
        }
        self._set_auth_mock('MANAGER_LOCAL', agence_id=self.agence.id_agence)
        
        url = reverse('bus-list-create')
        response = self.client.post(url, api_bus_data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['immatriculation'], 'LT123AB')
        self.assertEqual(response.data['modele'], 'Coaster')
    
    def test_list_buses(self):
        """Test liste des bus (public)"""
        self._clear_auth()
        Bus.objects.create(**self.bus_data)
        
        url = reverse('bus-list-create')
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['immatriculation'], 'LT123AB')
    
    def test_get_bus_detail(self):
        """Test détail d'un bus (public)"""
        self._clear_auth()
        bus = Bus.objects.create(**self.bus_data)
        
        url = reverse('bus-detail', args=[bus.IdBus])
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['immatriculation'], 'LT123AB')
    
    def test_update_bus_status(self):
        """Test mise à jour du statut d'un bus (Manager Local)"""
        bus = Bus.objects.create(**self.bus_data)
        self._set_auth_mock('MANAGER_LOCAL', agence_id=self.agence.id_agence)
        
        url = reverse('bus-status-update', args=[bus.IdBus])
        response = self.client.put(url, {'etat': 'en_voyage', 'raison': 'Départ programmé'}, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['bus']['etat'], 'en_voyage')
        
        bus.refresh_from_db()
        self.assertEqual(bus.etat, StatusBus.EN_VOYAGE)
    
    # def test_delete_bus(self):
    #     """Test suppression d'un bus (Manager Local)"""
    #     # Créer un bus avec une immatriculation unique
    #     bus = Bus.objects.create(
    #         modele='Coaster',
    #         immatriculation='LT999XY',
    #         capacite=45,
    #         etat=StatusBus.DISPONIBLE,
    #         Id_agence=self.agence
    #     )
    #     self._set_auth_mock('MANAGER_LOCAL', agence_id=self.agence.id_agence)
        
    #     url = reverse('bus-detail', args=[bus.IdBus])
    #     response = self.client.delete(url)
        
    #     self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
    #     self.assertEqual(Bus.objects.filter(immatriculation='LT999XY').count(), 0)
    
    # def test_delete_bus_en_voyage_fails(self):
    #     """Test suppression d'un bus en voyage (doit échouer)"""
    #     bus = Bus.objects.create(
    #         modele='Coaster',
    #         immatriculation='LT999ZZ',
    #         capacite=45,
    #         etat=StatusBus.EN_VOYAGE,  
    #         Id_agence=self.agence
    #     )
    #     self._set_auth_mock('MANAGER_LOCAL', agence_id=self.agence.id_agence)
        
    #     url = reverse('bus-detail', args=[bus.IdBus])
    #     response = self.client.delete(url)
        
    #     self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    #     self.assertIn('error', response.data)


class VoyageAPITest(AuthenticatedAPITest):
    """Tests des endpoints API pour les voyages"""
    
    def setUp(self):
        super().setUp()
        self.agence = Agence.objects.create(
            name='General Voyages',
            adresse='Bld de la Liberté, Douala',
            telephone='677777777',
            email_officiel='contact@generalvoyages.cm'
        )
        
        self.filiale_depart = Filiale.objects.create(
            agence=self.agence,
            nom='General Voyages Douala',
            code='GV-DLA',
            ville='Douala',
            adresse='Bld de la Liberté',
            telephone='677777778',
            email='douala@generalvoyages.cm'
        )
        
        self.filiale_arrivee = Filiale.objects.create(
            agence=self.agence,
            nom='General Voyages Yaoundé',
            code='GV-YDE',
            ville='Yaoundé',
            adresse='Bld du 20 Mai',
            telephone='677777779',
            email='yaounde@generalvoyages.cm'
        )
        
        self.trajet = Trajet.objects.create(
            filiale_depart=self.filiale_depart,
            filiale_arrive=self.filiale_arrivee,
            distance=210.5
        )
        
        self.bus = Bus.objects.create(
            modele='Coaster',
            immatriculation='LT123AB',
            capacite=45,
            Id_agence=self.agence
        )
    
    def test_list_voyages(self):
        """Test liste des voyages (public)"""
        self._clear_auth()
        Voyage.objects.create(
            date_heure_depart=timezone.now() + timedelta(days=1),
            date_heure_arrive_prevue=timezone.now() + timedelta(days=1, hours=4),
            prix=5000,
            type_voyage='standard',
            places_disponibles=45,
            IdBus=self.bus,
            Id_trajet=self.trajet
        )
        
        url = reverse('voyage-list-create')
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
    
    def test_search_voyages(self):
        """Test recherche de voyages (public)"""
        self._clear_auth()
        Voyage.objects.create(
            date_heure_depart=timezone.now() + timedelta(days=1),
            date_heure_arrive_prevue=timezone.now() + timedelta(days=1, hours=4),
            prix=5000,
            type_voyage='standard',
            places_disponibles=45,
            IdBus=self.bus,
            Id_trajet=self.trajet
        )
        
        url = reverse('voyage-search')
        response = self.client.get(url, {
            'depart': 'Douala',
            'arrivee': 'Yaoundé',
            'date': (timezone.now() + timedelta(days=1)).date().isoformat()
        })
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
    
    def test_create_voyage(self):
        """Test création d'un voyage via API (Manager Local)"""
        voyage_data = {
            'date_heure_depart': (timezone.now() + timedelta(days=1)).isoformat(),
            'date_heure_arrive_prevue': (timezone.now() + timedelta(days=1, hours=4)).isoformat(),
            'prix': 5000,
            'type_voyage': 'standard',
            'places_disponibles': 45,
            'IdBus': self.bus.IdBus,
            'Id_trajet': self.trajet.Id_trajet
        }
        self._set_auth_mock('MANAGER_LOCAL', agence_id=self.agence.id_agence)
        
        url = reverse('voyage-list-create')
        response = self.client.post(url, voyage_data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(float(response.data['prix']), 5000)
        self.assertEqual(response.data['places_disponibles'], 45)
    
    def test_update_voyage_status(self):
        """Test mise à jour du statut d'un voyage (Manager Local)"""
        voyage = Voyage.objects.create(
            date_heure_depart=timezone.now() + timedelta(days=1),
            date_heure_arrive_prevue=timezone.now() + timedelta(days=1, hours=4),
            prix=5000,
            type_voyage='standard',
            places_disponibles=45,
            IdBus=self.bus,
            Id_trajet=self.trajet
        )
        self._set_auth_mock('MANAGER_LOCAL', agence_id=self.agence.id_agence)
        
        url = reverse('voyage-status', args=[voyage.Id_voyage])
        response = self.client.put(url, {'status': 'confirme'}, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['voyage']['status'], 'confirme')


class AvisAPITest(AuthenticatedAPITest):
    """Tests des endpoints API pour les avis"""
    
    def setUp(self):
        super().setUp()
        self.agence = Agence.objects.create(
            name='General Voyages',
            adresse='Bld de la Liberté, Douala',
            telephone='677777777',
            email_officiel='contact@generalvoyages.cm'
        )
        
        self.filiale_depart = Filiale.objects.create(
            agence=self.agence,
            nom='General Voyages Douala',
            code='GV-DLA',
            ville='Douala',
            adresse='Bld de la Liberté',
            telephone='677777778',
            email='douala@generalvoyages.cm'
        )
        
        self.filiale_arrivee = Filiale.objects.create(
            agence=self.agence,
            nom='General Voyages Yaoundé',
            code='GV-YDE',
            ville='Yaoundé',
            adresse='Bld du 20 Mai',
            telephone='677777779',
            email='yaounde@generalvoyages.cm'
        )
        
        self.trajet = Trajet.objects.create(
            filiale_depart=self.filiale_depart,
            filiale_arrive=self.filiale_arrivee,
            distance=210.5
        )
        
        self.bus = Bus.objects.create(
            modele='Coaster',
            immatriculation='LT123AB',
            capacite=45,
            Id_agence=self.agence
        )
        
        self.voyage = Voyage.objects.create(
            date_heure_depart=timezone.now() + timedelta(days=1),
            date_heure_arrive_prevue=timezone.now() + timedelta(days=1, hours=4),
            prix=5000,
            type_voyage='standard',
            places_disponibles=45,
            IdBus=self.bus,
            Id_trajet=self.trajet
        )
    
    def test_list_avis(self):
        """Test liste des avis (public)"""
        self._clear_auth()
        avis_data = {
            'note': 4,
            'commentaires': 'Très bon voyage',
            'Id_voyage': self.voyage,  
            'user_id': uuid.uuid4()
        }
        Avis.objects.create(**avis_data)
        
        url = reverse('avis-list-create')
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['note'], 4)
    
    def test_create_avis(self):
        """Test création d'un avis via API (Voyageur)"""
        api_avis_data = {
            'note': 4,
            'commentaires': 'Très bon voyage',
            'Id_voyage': self.voyage.Id_voyage,  
            'user_id': uuid.uuid4()
        }
        self._set_auth_mock('VOYAGEUR', agence_id=self.agence.id_agence)
        
        url = reverse('avis-list-create')
        response = self.client.post(url, api_avis_data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['note'], 4)
        self.assertEqual(response.data['commentaires'], 'Très bon voyage')
    
    def test_avis_stats(self):
        """Test statistiques des avis pour un voyage (public)"""
        self._clear_auth()
        avis_data = {
            'note': 4,
            'commentaires': 'Très bon voyage',
            'Id_voyage': self.voyage,  
            'user_id': uuid.uuid4()
        }
        Avis.objects.create(**avis_data)
        Avis.objects.create(
            note=5,
            commentaires='Excellent',
            Id_voyage=self.voyage,  
            user_id=uuid.uuid4()
        )
        
        url = reverse('avis-stats', args=[self.voyage.Id_voyage])
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['total_avis'], 2)
        self.assertEqual(response.data['note_moyenne'], 4.5)


class AssignationAPITest(AuthenticatedAPITest):
    """Tests des endpoints d'assignation"""
    
    def setUp(self):
        super().setUp()
        self.agence = Agence.objects.create(
            name='General Voyages',
            adresse='Bld de la Liberté, Douala',
            telephone='677777777',
            email_officiel='contact@generalvoyages.cm'
        )
        
        self.filiale_depart = Filiale.objects.create(
            agence=self.agence,
            nom='General Voyages Douala',
            code='GV-DLA',
            ville='Douala',
            adresse='Bld de la Liberté',
            telephone='677777778',
            email='douala@generalvoyages.cm'
        )
        self.filiale = self.filiale_depart
        
        self.filiale_arrivee = Filiale.objects.create(
            agence=self.agence,
            nom='General Voyages Yaoundé',
            code='GV-YDE',
            ville='Yaoundé',
            adresse='Bld du 20 Mai',
            telephone='677777779',
            email='yaounde@generalvoyages.cm'
        )
        
        self.trajet = Trajet.objects.create(
            filiale_depart=self.filiale_depart,
            filiale_arrive=self.filiale_arrivee,
            distance=210.5
        )
        
        # Bus pour le voyage (obligatoire)
        self.bus_voyage = Bus.objects.create(
            modele='Coaster',
            immatriculation='LT000ZZ',
            capacite=45,
            etat=StatusBus.DISPONIBLE,
            Id_agence=self.agence
        )
        
        # Bus pour les tests d'assignation
        self.bus = Bus.objects.create(
            modele='Coaster',
            immatriculation='LT123AB',
            capacite=45,
            etat=StatusBus.DISPONIBLE,
            Id_agence=self.agence
        )
        
        self.chauffeur = Chauffeur.objects.create(
            numero_permis='D12345678',
            name='Jean',
            surname='Ndong',
            email='jean@example.com',
            phone='699999999',
            Adresse='Douala',
            Id_agence=self.agence,
            est_disponible=True,
            date_embauche=timezone.now().date()
        )
        
        # Création du voyage AVEC un bus (obligatoire)
        self.voyage = Voyage.objects.create(
            date_heure_depart=timezone.now() + timedelta(days=1),
            date_heure_arrive_prevue=timezone.now() + timedelta(days=1, hours=4),
            prix=5000,
            type_voyage='standard',
            places_disponibles=45,
            Id_trajet=self.trajet,
            IdBus=self.bus_voyage,
            status=StatusVoyage.PROGRAMME
        )
    
    def test_assign_bus_to_voyage(self):
        """Test assignation d'un bus à un voyage (Manager Local)"""
        self._set_auth_mock('MANAGER_LOCAL', agence_id=self.agence.id_agence)
        
        url = reverse('voyage-assign-bus', args=[self.voyage.Id_voyage])
        response = self.client.post(url, {'bus_id': self.bus.IdBus}, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['message'], 'Bus assigné avec succès')
        
        self.voyage.refresh_from_db()
        self.assertEqual(self.voyage.IdBus.IdBus, self.bus.IdBus)
        
        self.bus.refresh_from_db()
        self.assertEqual(self.bus.etat, StatusBus.EN_VOYAGE)
    
    def test_assign_chauffeur_to_voyage(self):
        """Test assignation d'un chauffeur à un voyage (Manager Local)"""
        self._set_auth_mock('MANAGER_LOCAL', agence_id=self.agence.id_agence)
        
        url = reverse('voyage-assign-chauffeur', args=[self.voyage.Id_voyage])
        response = self.client.post(url, {'chauffeur_id': self.chauffeur.id_chauffeur}, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['message'], 'Chauffeur assigné avec succès')
        
        self.voyage.refresh_from_db()
        self.assertEqual(self.voyage.id_chauffeur.id_chauffeur, self.chauffeur.id_chauffeur)
        
        self.chauffeur.refresh_from_db()
        self.assertFalse(self.chauffeur.est_disponible)