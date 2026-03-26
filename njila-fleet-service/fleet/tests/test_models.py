from django.test import TestCase
from django.utils import timezone
from django.core.exceptions import ValidationError
from fleet.models import (
    Agence, Bus, Guichetier, Chauffeur, Trajet, 
    Voyage, Filiale, Annonce, Avis,
    StatusBus, StatusVoyage, StatutGlobalAgence, TypeAnnonce
)
import uuid
from datetime import datetime, timedelta


class AgenceModelTest(TestCase):
    """Tests pour le modèle Agence"""
    
    def setUp(self):
        self.agence_data = {
            'name': 'General Voyages',
            'adresse': 'Bld de la Liberté, Douala',
            'telephone': '677777777',
            'email_officiel': 'contact@generalvoyages.cm',
            'statut_global': StatutGlobalAgence.ACTIVE,
            'logo_image': 'https://example.com/logo.png'
        }
    
    def test_create_agence(self):
        """Test création d'une agence"""
        agence = Agence.objects.create(**self.agence_data)
        self.assertEqual(agence.name, 'General Voyages')
        self.assertEqual(agence.email_officiel, 'contact@generalvoyages.cm')
        self.assertIsNotNone(agence.id_agence)
        self.assertIsNotNone(agence.date_inscription)
    
    def test_agence_str(self):
        """Test représentation string"""
        agence = Agence.objects.create(**self.agence_data)
        self.assertEqual(str(agence), 'General Voyages')
    
    def test_agence_unique_email(self):
        """Test unicité de l'email"""
        Agence.objects.create(**self.agence_data)
        with self.assertRaises(Exception):
            Agence.objects.create(**self.agence_data)
    
    def test_agence_default_statut(self):
        """Test statut par défaut"""
        del self.agence_data['statut_global']
        agence = Agence.objects.create(**self.agence_data)
        self.assertEqual(agence.statut_global, StatutGlobalAgence.ACTIVE)


class FilialeModelTest(TestCase):
    """Tests pour le modèle Filiale"""
    
    def setUp(self):
        self.agence = Agence.objects.create(
            name='General Voyages',
            adresse='Bld de la Liberté, Douala',
            telephone='677777777',
            email_officiel='contact@generalvoyages.cm'
        )
        
        self.filiale_data = {
            'agence': self.agence,
            'nom': 'General Voyages Douala',
            'code': 'GV-DLA',
            'ville': 'Douala',
            'adresse': 'Bld de la Liberté',
            'telephone': '677777778',
            'email': 'douala@generalvoyages.cm'
        }
    
    def test_create_filiale(self):
        """Test création d'une filiale"""
        filiale = Filiale.objects.create(**self.filiale_data)
        self.assertEqual(filiale.nom, 'General Voyages Douala')
        self.assertEqual(filiale.agence.name, 'General Voyages')
        self.assertIsNotNone(filiale.id_filiale)
    
    def test_filiale_str(self):
        """Test représentation string"""
        filiale = Filiale.objects.create(**self.filiale_data)
        self.assertEqual(str(filiale), 'General Voyages Douala - Douala')
    
    def test_filiale_unique_code_by_agence(self):
        """Test unicité du code par agence"""
        Filiale.objects.create(**self.filiale_data)
        with self.assertRaises(Exception):
            Filiale.objects.create(**self.filiale_data)


class BusModelTest(TestCase):
    """Tests pour le modèle Bus"""
    
    def setUp(self):
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
        """Test création d'un bus"""
        bus = Bus.objects.create(**self.bus_data)
        self.assertEqual(bus.immatriculation, 'LT123AB')
        self.assertEqual(bus.capacite, 45)
        self.assertEqual(bus.etat, StatusBus.DISPONIBLE)
    
    def test_bus_str(self):
        """Test représentation string"""
        bus = Bus.objects.create(**self.bus_data)
        self.assertEqual(str(bus), 'LT123AB - Coaster')
    
    def test_bus_unique_immatriculation(self):
        """Test unicité de l'immatriculation"""
        Bus.objects.create(**self.bus_data)
        with self.assertRaises(Exception):
            Bus.objects.create(**self.bus_data)
    
    def test_bus_capacite_validation(self):
        """Test validation de la capacité"""
        self.bus_data['capacite'] = 150
        bus = Bus(**self.bus_data)
        with self.assertRaises(ValidationError):
            bus.full_clean()


class ChauffeurModelTest(TestCase):
    """Tests pour le modèle Chauffeur"""
    
    def setUp(self):
        self.agence = Agence.objects.create(
            name='General Voyages',
            adresse='Bld de la Liberté, Douala',
            telephone='677777777',
            email_officiel='contact@generalvoyages.cm'
        )
        
        self.chauffeur_data = {
            'numero_permis': 'D12345678',
            'name': 'Jean',
            'surname': 'Ndong',
            'email': 'jean.ndong@example.com',
            'phone': '699999999',
            'Adresse': 'Quartier Makepe, Douala',
            'photo_profil': 'https://example.com/photo.jpg',
            'Id_agence': self.agence,
            'date_embauche': timezone.now().date()
        }
    
    def test_create_chauffeur(self):
        """Test création d'un chauffeur"""
        chauffeur = Chauffeur.objects.create(**self.chauffeur_data)
        self.assertEqual(chauffeur.name, 'Jean')
        self.assertEqual(chauffeur.surname, 'Ndong')
        self.assertEqual(chauffeur.numero_permis, 'D12345678')
        self.assertTrue(chauffeur.est_disponible)
    
    def test_chauffeur_str(self):
        """Test représentation string"""
        chauffeur = Chauffeur.objects.create(**self.chauffeur_data)
        self.assertEqual(str(chauffeur), 'Jean Ndong - D12345678')
    
    def test_chauffeur_unique_email(self):
        """Test unicité de l'email"""
        Chauffeur.objects.create(**self.chauffeur_data)
        with self.assertRaises(Exception):
            Chauffeur.objects.create(**self.chauffeur_data)
    
    def test_chauffeur_unique_permis(self):
        """Test unicité du numéro de permis"""
        Chauffeur.objects.create(**self.chauffeur_data)
        self.chauffeur_data['email'] = 'autre@example.com'
        with self.assertRaises(Exception):
            Chauffeur.objects.create(**self.chauffeur_data)


class TrajetModelTest(TestCase):
    """Tests pour le modèle Trajet"""
    
    def setUp(self):
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
        
        self.trajet_data = {
            'filiale_depart': self.filiale_depart,
            'filiale_arrive': self.filiale_arrivee,
            'distance': 210.5
        }
    
    def test_create_trajet(self):
        """Test création d'un trajet"""
        trajet = Trajet.objects.create(**self.trajet_data)
        self.assertEqual(trajet.distance, 210.5)
        self.assertEqual(trajet.filiale_depart.nom, 'General Voyages Douala')
        self.assertEqual(trajet.filiale_arrive.nom, 'General Voyages Yaoundé')
    
    def test_trajet_str(self):
        """Test représentation string"""
        trajet = Trajet.objects.create(**self.trajet_data)
        expected = 'General Voyages Douala → General Voyages Yaoundé (210.5 km)'
        self.assertEqual(str(trajet), expected)
    
    def test_trajet_unique_depart_arrivee(self):
        """Test unicité du couple départ/arrivée"""
        Trajet.objects.create(**self.trajet_data)
        with self.assertRaises(Exception):
            Trajet.objects.create(**self.trajet_data)


class VoyageModelTest(TestCase):
    """Tests pour le modèle Voyage"""
    
    def setUp(self):
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
            'date_heure_depart': timezone.now() + timedelta(days=1),
            'date_heure_arrive_prevue': timezone.now() + timedelta(days=1, hours=4),
            'prix': 5000,
            'type_voyage': 'standard',
            'status': StatusVoyage.PROGRAMME,
            'places_disponibles': 45,
            'places_total_reservees': 0,
            'IdBus': self.bus,
            'Id_trajet': self.trajet
        }
    
    def test_create_voyage(self):
        """Test création d'un voyage"""
        voyage = Voyage.objects.create(**self.voyage_data)
        self.assertEqual(voyage.prix, 5000)
        self.assertEqual(voyage.places_disponibles, 45)
        self.assertEqual(voyage.status, StatusVoyage.PROGRAMME)
    
    def test_voyage_str(self):
        """Test représentation string"""
        voyage = Voyage.objects.create(**self.voyage_data)
        expected = f"{self.trajet} - {voyage.date_heure_depart.strftime('%d/%m/%Y %H:%M')}"
        self.assertEqual(str(voyage), expected)
    
    def test_places_restantes(self):
        """Test méthode places_restantes"""
        voyage = Voyage.objects.create(**self.voyage_data)
        self.assertEqual(voyage.places_restantes(), 45)
        
        voyage.places_disponibles = 30
        self.assertEqual(voyage.places_restantes(), 30)


class AnnonceModelTest(TestCase):
    """Tests pour le modèle Annonce"""
    
    def setUp(self):
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
        
        self.annonce_data = {
            'type': TypeAnnonce.RETARD,
            'message': 'Le voyage aura 30 minutes de retard',
            'Id_voyage': self.voyage
        }
    
    def test_create_annonce(self):
        """Test création d'une annonce"""
        annonce = Annonce.objects.create(**self.annonce_data)
        self.assertEqual(annonce.type, TypeAnnonce.RETARD)
        self.assertEqual(annonce.message, 'Le voyage aura 30 minutes de retard')
        self.assertIsNotNone(annonce.datePublication)
    
    def test_annonce_str(self):
        """Test représentation string"""
        annonce = Annonce.objects.create(**self.annonce_data)
        expected = f"Retard - {self.voyage} - {annonce.datePublication.strftime('%d/%m/%Y')}"
        self.assertEqual(str(annonce), expected)


class AvisModelTest(TestCase):
    """Tests pour le modèle Avis"""
    
    def setUp(self):
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
        
        self.avis_data = {
            'note': 4,
            'commentaires': 'Très bon voyage, confortable',
            'Id_voyage': self.voyage,
            'user_id': uuid.uuid4()
        }
    
    def test_create_avis(self):
        """Test création d'un avis"""
        avis = Avis.objects.create(**self.avis_data)
        self.assertEqual(avis.note, 4)
        self.assertEqual(avis.commentaires, 'Très bon voyage, confortable')
        self.assertIsNotNone(avis.date_avis)
    
    def test_avis_str(self):
        """Test représentation string"""
        avis = Avis.objects.create(**self.avis_data)
        expected = f"Avis 4/5 - Voyage {self.voyage}"
        self.assertEqual(str(avis), expected)
    
    def test_avis_note_validation(self):
        """Test validation de la note"""
        self.avis_data['note'] = 6
        avis = Avis(**self.avis_data)
        with self.assertRaises(ValidationError):
            avis.full_clean()
        
        self.avis_data['note'] = 0
        avis = Avis(**self.avis_data)
        with self.assertRaises(ValidationError):
            avis.full_clean()
    
    def test_avis_unique_per_user_per_voyage(self):
        """Test unicité d'un avis par utilisateur et voyage"""
        Avis.objects.create(**self.avis_data)
        with self.assertRaises(Exception):
            Avis.objects.create(**self.avis_data)