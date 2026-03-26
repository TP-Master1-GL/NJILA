import uuid
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


class AgenceAPITest(TestCase):
    """Tests des endpoints API pour les agences"""
    
    def setUp(self):
        self.client = APIClient()
        
        self.agence_data = {
            'name': 'General Voyages',
            'adresse': 'Bld de la Liberté, Douala',
            'telephone': '677777777',
            'email_officiel': 'contact@generalvoyages.cm',
            'statut_global': StatutGlobalAgence.ACTIVE,
            'logo_image': 'https://example.com/logo.png'
        }
    
    @patch('fleet.views.publish_agence_created')
    @patch('fleet.views.publish_agence_subscription_request')
    def test_create_agence(self, mock_subscription, mock_agence_created):
        """Test création d'une agence via API"""
        url = reverse('agence-list-create')
        response = self.client.post(url, self.agence_data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['name'], 'General Voyages')
        self.assertEqual(response.data['email_officiel'], 'contact@generalvoyages.cm')
        
        mock_agence_created.assert_called_once()
        mock_subscription.assert_called_once()
    
    def test_create_agence_duplicate_email(self):
        """Test création avec email dupliqué"""
        Agence.objects.create(**self.agence_data)
        
        url = reverse('agence-list-create')
        response = self.client.post(url, self.agence_data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('email_officiel', response.data)
    
    def test_list_agences(self):
        """Test liste des agences"""
        Agence.objects.create(**self.agence_data)
        
        url = reverse('agence-list-create')
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['name'], 'General Voyages')
    
    def test_list_agences_filter_by_status(self):
        """Test liste avec filtre statut"""
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
        """Test recherche d'agences"""
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
        """Test mise à jour d'une agence"""
        agence = Agence.objects.create(**self.agence_data)
        
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
        """Test détail d'une agence"""
        agence = Agence.objects.create(**self.agence_data)
        
        url = reverse('agence-detail', args=[agence.id_agence])
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['name'], 'General Voyages')
        self.assertEqual(response.data['adresse'], 'Bld de la Liberté, Douala')
    
    def test_delete_agence(self):
        """Test suppression d'une agence"""
        agence = Agence.objects.create(**self.agence_data)
        
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
            Id_agence=agence  # Passe l'objet agence
        )
        
        url = reverse('agence-detail', args=[agence.id_agence])
        response = self.client.delete(url)
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)
        self.assertEqual(Agence.objects.count(), 1)


class FilialeAPITest(TestCase):
    """Tests des endpoints API pour les filiales"""
    
    def setUp(self):
        self.client = APIClient()
        
        self.agence = Agence.objects.create(
            name='General Voyages',
            adresse='Bld de la Liberté, Douala',
            telephone='677777777',
            email_officiel='contact@generalvoyages.cm'
        )
        
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
        """Test création d'une filiale via API"""
        url = reverse('filiale-list-create')
        response = self.client.post(url, self.filiale_data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['nom'], 'General Voyages Douala')
        self.assertEqual(response.data['ville'], 'Douala')
        mock_filiale_created.assert_called_once()
    
    def test_list_filiales(self):
        """Test liste des filiales"""
        Filiale.objects.create(
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
    
    def test_list_filiales_filter_by_agence(self):
        """Test liste des filiales par agence"""
        autre_agence = Agence.objects.create(
            name='Binam',
            adresse='Rue du Commerce',
            telephone='688888888',
            email_officiel='contact@binam.cm'
        )
        
        Filiale.objects.create(
            agence=self.agence,
            nom='General Voyages Douala',
            code='GV-DLA',
            ville='Douala',
            adresse='Bld de la Liberté',
            telephone='677777778',
            email='douala@generalvoyages.cm'
        )
        Filiale.objects.create(
            agence=autre_agence,
            nom='Binam Douala',
            code='BIN-DLA',
            ville='Douala',
            adresse='Rue du Commerce',
            telephone='688888889',
            email='douala@binam.cm'
        )
        
        url = reverse('filiale-list-create')
        response = self.client.get(url, {'agence_id': self.agence.id_agence})
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['nom'], 'General Voyages Douala')
    
    def test_filiale_stats(self):
        """Test statistiques d'une filiale"""
        filiale = Filiale.objects.create(
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
            Id_agence=self.agence  # Passe l'objet agence
        )
        
        url = reverse('filiale-stats', args=[filiale.id_filiale])
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['filiale']['nom'], 'General Voyages Douala')
        self.assertIn('bus_stats', response.data)


class BusAPITest(TestCase):
    """Tests des endpoints API pour les bus"""
    
    def setUp(self):
        self.client = APIClient()
        
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
        """Test création d'un bus via API"""
        
        api_bus_data = {
            'modele': 'Coaster',
            'immatriculation': 'LT123AB',
            'capacite': 45,
            'etat': StatusBus.DISPONIBLE,
            'Id_agence': self.agence.id_agence  
        }
        url = reverse('bus-list-create')
        response = self.client.post(url, api_bus_data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['immatriculation'], 'LT123AB')
        self.assertEqual(response.data['modele'], 'Coaster')
    
    def test_list_buses(self):
        """Test liste des bus"""
        Bus.objects.create(**self.bus_data)
        
        url = reverse('bus-list-create')
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['immatriculation'], 'LT123AB')
    
    def test_list_buses_filter_by_agence(self):
        """Test liste des bus par agence"""
        autre_agence = Agence.objects.create(
            name='Binam',
            adresse='Rue du Commerce',
            telephone='688888888',
            email_officiel='contact@binam.cm'
        )
        
        Bus.objects.create(**self.bus_data)
        Bus.objects.create(
            modele='Higer',
            immatriculation='LT456CD',
            capacite=60,
            etat=StatusBus.DISPONIBLE,
            Id_agence=autre_agence  
        )
        
        url = reverse('bus-list-create')
        response = self.client.get(url, {'agence_id': self.agence.id_agence})
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['immatriculation'], 'LT123AB')
    
    def test_get_bus_detail(self):
        """Test détail d'un bus"""
        bus = Bus.objects.create(**self.bus_data)
        
        url = reverse('bus-detail', args=[bus.IdBus])
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['immatriculation'], 'LT123AB')
    
    def test_update_bus_status(self):
        """Test mise à jour du statut d'un bus"""
        bus = Bus.objects.create(**self.bus_data)
        
        url = reverse('bus-status-update', args=[bus.IdBus])
        response = self.client.put(url, {'etat': 'en_voyage', 'raison': 'Départ programmé'}, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['bus']['etat'], 'en_voyage')
        
        bus.refresh_from_db()
        self.assertEqual(bus.etat, StatusBus.EN_VOYAGE)
    
    def test_delete_bus(self):
        """Test suppression d'un bus"""
        bus = Bus.objects.create(**self.bus_data)
        
        url = reverse('bus-detail', args=[bus.IdBus])
        response = self.client.delete(url)
        
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(Bus.objects.count(), 0)
    
    def test_delete_bus_en_voyage_fails(self):
        """Test suppression d'un bus en voyage (doit échouer)"""
        bus = Bus.objects.create(
            modele='Coaster',
            immatriculation='LT999ZZ',
            capacite=45,
            etat=StatusBus.EN_VOYAGE,  
            Id_agence=self.agence
        )
        
        url = reverse('bus-detail', args=[bus.IdBus])
        response = self.client.delete(url)
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)


class VoyageAPITest(TestCase):
    """Tests des endpoints API pour les voyages"""
    
    def setUp(self):
        self.client = APIClient()
        
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
        
        self.voyage_data = {
            'date_heure_depart': (timezone.now() + timedelta(days=1)).isoformat(),
            'date_heure_arrive_prevue': (timezone.now() + timedelta(days=1, hours=4)).isoformat(),
            'prix': 5000,
            'type_voyage': 'standard',
            'places_disponibles': 45,
            'IdBus': self.bus.IdBus,
            'Id_trajet': self.trajet.Id_trajet
        }
    
    def test_create_voyage(self):
        """Test création d'un voyage via API"""
        url = reverse('voyage-list-create')
        response = self.client.post(url, self.voyage_data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(float(response.data['prix']), 5000)
        self.assertEqual(response.data['places_disponibles'], 45)
    
    def test_list_voyages(self):
        """Test liste des voyages"""
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
        """Test recherche de voyages"""
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
    
    def test_update_voyage_status(self):
        """Test mise à jour du statut d'un voyage"""
        voyage = Voyage.objects.create(
            date_heure_depart=timezone.now() + timedelta(days=1),
            date_heure_arrive_prevue=timezone.now() + timedelta(days=1, hours=4),
            prix=5000,
            type_voyage='standard',
            places_disponibles=45,
            IdBus=self.bus,
            Id_trajet=self.trajet
        )
        
        url = reverse('voyage-status', args=[voyage.Id_voyage])
        response = self.client.put(url, {'status': 'confirme'}, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['voyage']['status'], 'confirme')


class AvisAPITest(TestCase):
    """Tests des endpoints API pour les avis"""
    
    def setUp(self):
        self.client = APIClient()
        
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
        
        # CORRIGÉ: Passer l'objet voyage, pas l'UUID
        self.avis_data = {
            'note': 4,
            'commentaires': 'Très bon voyage',
            'Id_voyage': self.voyage,  # ← Passe l'objet voyage
            'user_id': uuid.uuid4()
        }
    
    def test_create_avis(self):
        """Test création d'un avis via API"""
        # Pour l'API, on doit passer l'UUID
        api_avis_data = {
            'note': 4,
            'commentaires': 'Très bon voyage',
            'Id_voyage': self.voyage.Id_voyage,  # ← Pour l'API, passer l'UUID
            'user_id': uuid.uuid4()
        }
        url = reverse('avis-list-create')
        response = self.client.post(url, api_avis_data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['note'], 4)
        self.assertEqual(response.data['commentaires'], 'Très bon voyage')
    
    def test_list_avis(self):
        """Test liste des avis"""
        Avis.objects.create(**self.avis_data)
        
        url = reverse('avis-list-create')
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['note'], 4)
    
    def test_avis_stats(self):
        """Test statistiques des avis pour un voyage"""
        Avis.objects.create(**self.avis_data)
        Avis.objects.create(
            note=5,
            commentaires='Excellent',
            Id_voyage=self.voyage,  # ← Passe l'objet voyage
            user_id=uuid.uuid4()
        )
        
        url = reverse('avis-stats', args=[self.voyage.Id_voyage])
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['total_avis'], 2)
        self.assertEqual(response.data['note_moyenne'], 4.5)

# ============ TESTS ASSIGNATION BUS/CHAUFFEUR ============

class AssignationAPITest(TestCase):
    """Tests des endpoints d'assignation"""
    
    def setUp(self):
        self.client = APIClient()
        
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
            IdBus=self.bus_voyage,  # Bus initial obligatoire
            status=StatusVoyage.PROGRAMME
        )
    
    def test_assign_bus_to_voyage(self):
        """Test assignation d'un bus à un voyage"""
        url = reverse('voyage-assign-bus', args=[self.voyage.Id_voyage])
        response = self.client.post(url, {'bus_id': self.bus.IdBus}, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['message'], 'Bus assigné avec succès')
        
        self.voyage.refresh_from_db()
        self.assertEqual(self.voyage.IdBus.IdBus, self.bus.IdBus)
        
        self.bus.refresh_from_db()
        self.assertEqual(self.bus.etat, StatusBus.EN_VOYAGE)
        
        # L'ancien bus doit être libéré
        self.bus_voyage.refresh_from_db()
        self.assertEqual(self.bus_voyage.etat, StatusBus.DISPONIBLE)
    
    def test_assign_bus_to_voyage_with_nonexistent_bus(self):
        """Test assignation avec un bus inexistant"""
        url = reverse('voyage-assign-bus', args=[self.voyage.Id_voyage])
        response = self.client.post(url, {'bus_id': 99999}, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertIn('error', response.data)
    
    def test_assign_bus_to_voyage_bus_not_available(self):
        """Test assignation avec un bus non disponible"""
        self.bus.etat = StatusBus.EN_PANNE
        self.bus.save()
        
        url = reverse('voyage-assign-bus', args=[self.voyage.Id_voyage])
        response = self.client.post(url, {'bus_id': self.bus.IdBus}, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Ce bus n\'est pas disponible', response.data['error'])
    
    def test_assign_chauffeur_to_voyage(self):
        """Test assignation d'un chauffeur à un voyage"""
        url = reverse('voyage-assign-chauffeur', args=[self.voyage.Id_voyage])
        response = self.client.post(url, {'chauffeur_id': self.chauffeur.id_chauffeur}, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['message'], 'Chauffeur assigné avec succès')
        
        self.voyage.refresh_from_db()
        self.assertEqual(self.voyage.id_chauffeur.id_chauffeur, self.chauffeur.id_chauffeur)
        
        self.chauffeur.refresh_from_db()
        self.assertFalse(self.chauffeur.est_disponible)
    
    def test_assign_chauffeur_to_voyage_not_available(self):
        """Test assignation d'un chauffeur non disponible"""
        self.chauffeur.est_disponible = False
        self.chauffeur.save()
        
        url = reverse('voyage-assign-chauffeur', args=[self.voyage.Id_voyage])
        response = self.client.post(url, {'chauffeur_id': self.chauffeur.id_chauffeur}, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Ce chauffeur n\'est pas disponible', response.data['error'])
    
    def test_assign_chauffeur_without_id(self):
        """Test assignation sans ID chauffeur"""
        url = reverse('voyage-assign-chauffeur', args=[self.voyage.Id_voyage])
        response = self.client.post(url, {}, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('chauffeur_id est requis', response.data['error'])
    
    def test_assign_chauffeur_to_voyage_already_in_progress(self):
        """Test assignation à un voyage déjà en cours"""
        self.voyage.status = StatusVoyage.EN_COURS
        self.voyage.save()
        
        url = reverse('voyage-assign-chauffeur', args=[self.voyage.Id_voyage])
        response = self.client.post(url, {'chauffeur_id': self.chauffeur.id_chauffeur}, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Impossible d\'assigner', response.data['error'])
    
    def test_assign_bus_to_voyage_already_assigned(self):
        """Test assignation d'un bus différent à un voyage déjà assigné"""
        # D'abord assigner un bus
        url = reverse('voyage-assign-bus', args=[self.voyage.Id_voyage])
        response = self.client.post(url, {'bus_id': self.bus.IdBus}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Créer un autre bus
        autre_bus = Bus.objects.create(
            modele='Higer',
            immatriculation='LT456CD',
            capacite=60,
            etat=StatusBus.DISPONIBLE,
            Id_agence=self.agence
        )
        
        # Assigner un nouveau bus (devrait fonctionner et libérer l'ancien)
        response = self.client.post(url, {'bus_id': autre_bus.IdBus}, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['message'], 'Bus assigné avec succès')
        
        self.voyage.refresh_from_db()
        self.assertEqual(self.voyage.IdBus.IdBus, autre_bus.IdBus)
        
        # L'ancien bus doit être libéré
        self.bus.refresh_from_db()
        self.assertEqual(self.bus.etat, StatusBus.DISPONIBLE)
        
        # Le nouveau bus doit être en voyage
        autre_bus.refresh_from_db()
        self.assertEqual(autre_bus.etat, StatusBus.EN_VOYAGE)