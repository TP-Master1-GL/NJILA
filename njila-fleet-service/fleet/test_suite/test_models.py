"""
test_models.py — Tests unitaires des modèles Django du fleet-service.

Couverture :
  - Création et __str__ de chaque modèle
  - Contraintes d'unicité (email, immatriculation, etc.)
  - Valeurs par défaut
  - Méthodes utilitaires (get_logo, places_restantes)
  - Relations ForeignKey (cascade, protection)
"""

import uuid
import pytest
from decimal import Decimal
from django.test import TestCase
from django.core.exceptions import ValidationError
from django.db import IntegrityError
from django.utils import timezone

from fleet.models import (
    Agence, Filiale, Bus, Chauffeur, Guichetier, Trajet,
    Voyage, Annonce, Avis,
    ClasseBus, StatusBus, TypeVoyage, StatusVoyage,
    StatutGlobalAgence, TypeAnnonce,
)


# ─────────────────────────────────────────────────────────────────────────────
# Helpers — fixtures de base réutilisables
# ─────────────────────────────────────────────────────────────────────────────

def make_agence(**kwargs):
    defaults = dict(
        name='Express Voyages',
        adresse='123 Bd de la Liberté, Douala',
        telephone='699000001',
        email_officiel='contact@express.cm',
        statut_global=StatutGlobalAgence.ACTIVE,
    )
    defaults.update(kwargs)
    return Agence.objects.create(**defaults)


def make_filiale(agence, **kwargs):
    defaults = dict(
        agence=agence,
        nom='Agence Centrale Douala',
        code='DLA-001',
        ville='Douala',
        adresse='456 Rue Joffre, Douala',
        telephone='699000002',
        email='douala@express.cm',
        est_active=True,
    )
    defaults.update(kwargs)
    return Filiale.objects.create(**defaults)


def make_bus(agence, **kwargs):
    defaults = dict(
        modele='Toyota Coaster',
        immatriculation='LT001AB',
        capacite=30,
        etat=StatusBus.DISPONIBLE,
        Id_agence=agence,
    )
    defaults.update(kwargs)
    return Bus.objects.create(**defaults)


def make_chauffeur(agence, **kwargs):
    defaults = dict(
        numero_permis='P12345678',
        name='Pierre',
        surname='Kamga',
        email='pierre.kamga@express.cm',
        phone='699000003',
        Adresse='Makepe, Douala',
        Id_agence=agence,
        est_disponible=True,
        date_embauche='2023-01-15',
    )
    defaults.update(kwargs)
    return Chauffeur.objects.create(**defaults)


def make_trajet(filiale_dep, filiale_arr, **kwargs):
    defaults = dict(
        filiale_depart=filiale_dep,
        filiale_arrive=filiale_arr,
        distance=250.5,
        est_actif=True,
    )
    defaults.update(kwargs)
    return Trajet.objects.create(**defaults)


def make_voyage(trajet, bus, chauffeur=None, **kwargs):
    now = timezone.now()
    defaults = dict(
        date_heure_depart=now + timezone.timedelta(hours=2),
        date_heure_arrive_prevue=now + timezone.timedelta(hours=7),
        prix=Decimal('5000.00'),
        type_voyage=TypeVoyage.STANDARD,
        status=StatusVoyage.PROGRAMME,
        places_disponibles=30,
        places_total_reservees=0,
        id_chauffeur=chauffeur,
        IdBus=bus,
        Id_trajet=trajet,
    )
    defaults.update(kwargs)
    return Voyage.objects.create(**defaults)


# ─────────────────────────────────────────────────────────────────────────────
# Modèle : Agence
# ─────────────────────────────────────────────────────────────────────────────

class AgenceModelTest(TestCase):

    def test_creation_basique(self):
        agence = make_agence()
        self.assertIsNotNone(agence.id_agence)
        self.assertIsInstance(agence.id_agence, uuid.UUID)
        self.assertEqual(agence.statut_global, StatutGlobalAgence.ACTIVE)

    def test_str(self):
        agence = make_agence(name='Speed Bus')
        self.assertEqual(str(agence), 'Speed Bus')

    def test_email_unique(self):
        make_agence()
        with self.assertRaises(IntegrityError):
            make_agence(name='Autre Agence')  # même email_officiel

    def test_name_unique(self):
        make_agence()
        with self.assertRaises(IntegrityError):
            make_agence(email_officiel='autre@agence.cm')  # même name

    def test_get_logo_cloudinary_prioritaire(self):
        agence = make_agence(logo_url='https://res.cloudinary.com/test/logo.png')
        self.assertEqual(agence.get_logo(), 'https://res.cloudinary.com/test/logo.png')

    def test_get_logo_sans_logo(self):
        agence = make_agence()
        self.assertIsNone(agence.get_logo())

    def test_statuts_disponibles(self):
        for statut, _ in StatutGlobalAgence.choices:
            agence = Agence.objects.create(
                name=f'Agence_{statut}',
                adresse='Douala',
                telephone='699000099',
                email_officiel=f'{statut}@agence.cm',
                statut_global=statut,
            )
            self.assertEqual(agence.statut_global, statut)

    def test_auto_fields_dates(self):
        agence = make_agence()
        self.assertIsNotNone(agence.created_at)
        self.assertIsNotNone(agence.date_inscription)


# ─────────────────────────────────────────────────────────────────────────────
# Modèle : Filiale
# ─────────────────────────────────────────────────────────────────────────────

class FilialeModelTest(TestCase):

    def setUp(self):
        self.agence = make_agence()

    def test_creation(self):
        filiale = make_filiale(self.agence)
        self.assertIsInstance(filiale.id_filiale, uuid.UUID)
        self.assertEqual(filiale.agence, self.agence)

    def test_str(self):
        filiale = make_filiale(self.agence, nom='Filiale Yaoundé', ville='Yaoundé')
        self.assertIn('Yaoundé', str(filiale))

    def test_code_unique(self):
        make_filiale(self.agence, code='DLA-001')
        with self.assertRaises(IntegrityError):
            agence2 = Agence.objects.create(
                name='Agence2',
                adresse='Yaoundé',
                telephone='699000099',
                email_officiel='a2@exp.cm',
            )
            make_filiale(agence2, code='DLA-001')

    def test_cascade_suppression_agence(self):
        make_filiale(self.agence)
        self.agence.delete()
        self.assertEqual(Filiale.objects.count(), 0)

    def test_est_active_default_true(self):
        filiale = make_filiale(self.agence)
        self.assertTrue(filiale.est_active)

    def test_unique_together_agence_code(self):
        make_filiale(self.agence, code='UNIQUE-001')
        with self.assertRaises(IntegrityError):
            make_filiale(self.agence, code='UNIQUE-001', email='autre@test.cm')


# ─────────────────────────────────────────────────────────────────────────────
# Modèle : Bus
# ─────────────────────────────────────────────────────────────────────────────

class BusModelTest(TestCase):

    def setUp(self):
        self.agence = make_agence()

    def test_creation(self):
        bus = make_bus(self.agence)
        self.assertIsNotNone(bus.IdBus)
        self.assertEqual(bus.etat, StatusBus.DISPONIBLE)

    def test_str(self):
        bus = make_bus(self.agence, immatriculation='LT999ZZ', modele='Sprinter')
        s = str(bus)
        self.assertIn('LT999ZZ', s)
        self.assertIn('Sprinter', s)

    def test_immatriculation_unique(self):
        make_bus(self.agence, immatriculation='LT001AB')
        with self.assertRaises(IntegrityError):
            make_bus(self.agence, immatriculation='LT001AB')

    def test_statuts_bus(self):
        for i, (statut, _) in enumerate(StatusBus.choices):
            bus = Bus.objects.create(
                modele='Toyota',
                immatriculation=f'TESTBUS{i}',
                capacite=20,
                etat=statut,
                Id_agence=self.agence,
            )
            self.assertEqual(bus.etat, statut)

    def test_cascade_suppression_agence(self):
        make_bus(self.agence)
        self.agence.delete()
        self.assertEqual(Bus.objects.count(), 0)


# ─────────────────────────────────────────────────────────────────────────────
# Modèle : Chauffeur
# ─────────────────────────────────────────────────────────────────────────────

class ChauffeurModelTest(TestCase):

    def setUp(self):
        self.agence = make_agence()

    def test_creation(self):
        chauffeur = make_chauffeur(self.agence)
        self.assertIsInstance(chauffeur.id_chauffeur, uuid.UUID)
        self.assertTrue(chauffeur.est_disponible)

    def test_str(self):
        chauffeur = make_chauffeur(self.agence, name='Jean', surname='Mbarga')
        s = str(chauffeur)
        self.assertIn('Jean', s)
        self.assertIn('Mbarga', s)

    def test_email_unique(self):
        make_chauffeur(self.agence)
        with self.assertRaises(IntegrityError):
            make_chauffeur(self.agence, numero_permis='P99999999')

    def test_numero_permis_unique(self):
        make_chauffeur(self.agence)
        with self.assertRaises(IntegrityError):
            make_chauffeur(self.agence, email='autre@email.cm')

    def test_cascade_suppression_agence(self):
        make_chauffeur(self.agence)
        self.agence.delete()
        self.assertEqual(Chauffeur.objects.count(), 0)

    def test_uuid_custom_preservé(self):
        custom_id = uuid.uuid4()
        chauffeur = Chauffeur.objects.create(
            id_chauffeur=custom_id,
            numero_permis='PXXX1234',
            name='Test',
            surname='User',
            email='testcustom@email.cm',
            phone='699000011',
            Adresse='Douala',
            Id_agence=self.agence,
            est_disponible=True,
            date_embauche='2024-01-01',
        )
        self.assertEqual(chauffeur.id_chauffeur, custom_id)


# ─────────────────────────────────────────────────────────────────────────────
# Modèle : Guichetier
# ─────────────────────────────────────────────────────────────────────────────

class GuichetierModelTest(TestCase):

    def setUp(self):
        self.agence = make_agence()
        self.filiale = make_filiale(self.agence)

    def test_creation(self):
        from django.contrib.auth.hashers import make_password
        guichetier = Guichetier.objects.create(
            name='Marie',
            surname='Essonba',
            email='marie@express.cm',
            phone='699000010',
            adresse='Yaoundé',
            password=make_password('TempPass123'),
            _id_filiale=self.filiale,
            est_actif=True,
        )
        self.assertIsInstance(guichetier.Id_guichetier, uuid.UUID)
        self.assertTrue(guichetier.est_actif)

    def test_str(self):
        from django.contrib.auth.hashers import make_password
        g = Guichetier.objects.create(
            name='Luc',
            surname='Bello',
            email='luc@express.cm',
            phone='699000012',
            adresse='Douala',
            password=make_password('pass'),
        )
        s = str(g)
        self.assertIn('Luc', s)

    def test_email_unique(self):
        from django.contrib.auth.hashers import make_password
        Guichetier.objects.create(
            name='G1', surname='X', email='gtest@express.cm',
            phone='699000020', adresse='Douala',
            password=make_password('p'),
        )
        with self.assertRaises(IntegrityError):
            Guichetier.objects.create(
                name='G2', surname='Y', email='gtest@express.cm',
                phone='699000021', adresse='Douala',
                password=make_password('p'),
            )


# ─────────────────────────────────────────────────────────────────────────────
# Modèle : Trajet
# ─────────────────────────────────────────────────────────────────────────────

class TrajetModelTest(TestCase):

    def setUp(self):
        self.agence = make_agence()
        self.filiale_dlo = make_filiale(self.agence, nom='Douala', code='DLA', ville='Douala')
        self.filiale_yde = make_filiale(
            self.agence, nom='Yaoundé', code='YDE', ville='Yaoundé', email='yde@exp.cm'
        )

    def test_creation(self):
        trajet = make_trajet(self.filiale_dlo, self.filiale_yde)
        self.assertIsInstance(trajet.Id_trajet, uuid.UUID)
        self.assertEqual(trajet.distance, 250.5)

    def test_str(self):
        trajet = make_trajet(self.filiale_dlo, self.filiale_yde)
        s = str(trajet)
        self.assertIn('→', s)

    def test_unique_together_depart_arrivee(self):
        make_trajet(self.filiale_dlo, self.filiale_yde)
        with self.assertRaises(IntegrityError):
            make_trajet(self.filiale_dlo, self.filiale_yde)

    def test_est_actif_default(self):
        trajet = make_trajet(self.filiale_dlo, self.filiale_yde)
        self.assertTrue(trajet.est_actif)


# ─────────────────────────────────────────────────────────────────────────────
# Modèle : Voyage
# ─────────────────────────────────────────────────────────────────────────────

class VoyageModelTest(TestCase):

    def setUp(self):
        self.agence = make_agence()
        self.filiale_dlo = make_filiale(self.agence, code='DLA', ville='Douala')
        self.filiale_yde = make_filiale(
            self.agence, code='YDE', ville='Yaoundé', email='yde@exp.cm'
        )
        self.bus = make_bus(self.agence)
        self.chauffeur = make_chauffeur(self.agence)
        self.trajet = make_trajet(self.filiale_dlo, self.filiale_yde)

    def test_creation(self):
        voyage = make_voyage(self.trajet, self.bus, self.chauffeur)
        self.assertIsInstance(voyage.Id_voyage, uuid.UUID)
        self.assertEqual(voyage.status, StatusVoyage.PROGRAMME)
        self.assertEqual(voyage.places_total_reservees, 0)

    def test_str_contient_dates(self):
        voyage = make_voyage(self.trajet, self.bus)
        s = str(voyage)
        self.assertIsInstance(s, str)
        self.assertGreater(len(s), 0)

    def test_places_restantes(self):
        voyage = make_voyage(self.trajet, self.bus, places_disponibles=25)
        self.assertEqual(voyage.places_restantes(), 25)

    def test_statuts_voyage(self):
        for i, (statut, _) in enumerate(StatusVoyage.choices):
            now = timezone.now()
            v = Voyage.objects.create(
                date_heure_depart=now + timezone.timedelta(hours=i + 1),
                date_heure_arrive_prevue=now + timezone.timedelta(hours=i + 6),
                prix=Decimal('5000.00'),
                type_voyage=TypeVoyage.STANDARD,
                status=statut,
                places_disponibles=30,
                IdBus=self.bus,
                Id_trajet=self.trajet,
            )
            self.assertEqual(v.status, statut)

    def test_protection_bus_lors_suppression_trajet(self):
        """ON DELETE PROTECT : on ne peut pas supprimer un trajet avec des voyages."""
        make_voyage(self.trajet, self.bus)
        from django.db import models
        with self.assertRaises(Exception):
            self.trajet.delete()

    def test_chauffeur_set_null_si_supprime(self):
        voyage = make_voyage(self.trajet, self.bus, self.chauffeur)
        self.chauffeur.delete()
        voyage.refresh_from_db()
        self.assertIsNone(voyage.id_chauffeur)


# ─────────────────────────────────────────────────────────────────────────────
# Modèle : Annonce
# ─────────────────────────────────────────────────────────────────────────────

class AnnonceModelTest(TestCase):

    def setUp(self):
        self.agence = make_agence()
        filiale_d = make_filiale(self.agence, code='DLA', ville='Douala')
        filiale_y = make_filiale(
            self.agence, code='YDE', ville='Yaoundé', email='yde@exp.cm'
        )
        bus = make_bus(self.agence)
        trajet = make_trajet(filiale_d, filiale_y)
        self.voyage = make_voyage(trajet, bus)

    def test_creation(self):
        annonce = Annonce.objects.create(
            type=TypeAnnonce.INFORMATION,
            message='Voyage maintenu malgré la pluie.',
            Id_voyage=self.voyage,
            est_active=True,
        )
        self.assertIsInstance(annonce.id_annonce, uuid.UUID)
        self.assertTrue(annonce.est_active)

    def test_str(self):
        annonce = Annonce.objects.create(
            type=TypeAnnonce.RETARD,
            message='Retard de 30 minutes.',
            Id_voyage=self.voyage,
        )
        s = str(annonce)
        self.assertIn('Retard', s)

    def test_cascade_suppression_voyage(self):
        Annonce.objects.create(
            type=TypeAnnonce.PROMOTION,
            message='Promotion spéciale.',
            Id_voyage=self.voyage,
        )
        self.voyage.delete()
        self.assertEqual(Annonce.objects.count(), 0)


# ─────────────────────────────────────────────────────────────────────────────
# Modèle : Avis
# ─────────────────────────────────────────────────────────────────────────────

class AvisModelTest(TestCase):

    def setUp(self):
        self.agence = make_agence()
        filiale_d = make_filiale(self.agence, code='DLA', ville='Douala')
        filiale_y = make_filiale(
            self.agence, code='YDE', ville='Yaoundé', email='yde@exp.cm'
        )
        bus = make_bus(self.agence)
        trajet = make_trajet(filiale_d, filiale_y)
        self.voyage = make_voyage(trajet, bus)
        self.user_id = uuid.uuid4()

    def test_creation(self):
        avis = Avis.objects.create(
            note=5,
            commentaires='Excellent voyage !',
            Id_voyage=self.voyage,
            user_id=self.user_id,
            est_approuve=True,
        )
        self.assertIsInstance(avis.id_avis, uuid.UUID)
        self.assertEqual(avis.note, 5)

    def test_str(self):
        avis = Avis.objects.create(
            note=4,
            commentaires='Bien.',
            Id_voyage=self.voyage,
            user_id=self.user_id,
        )
        s = str(avis)
        self.assertIn('4', s)

    def test_unique_together_user_voyage(self):
        Avis.objects.create(
            note=3, commentaires='Moyen.',
            Id_voyage=self.voyage, user_id=self.user_id,
        )
        with self.assertRaises(IntegrityError):
            Avis.objects.create(
                note=5, commentaires='Excellent !',
                Id_voyage=self.voyage, user_id=self.user_id,
            )

    def test_cascade_suppression_voyage(self):
        Avis.objects.create(
            note=5, commentaires='Super.',
            Id_voyage=self.voyage, user_id=self.user_id,
        )
        self.voyage.delete()
        self.assertEqual(Avis.objects.count(), 0)