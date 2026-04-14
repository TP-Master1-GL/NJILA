from django.test import TestCase
from agencies.models import AgenceMere
from subscriptions.models import Abonnement, PlanChoices, StatutAbonnement
from agencies.management.commands.consume_fleet_events import Command
from unittest.mock import MagicMock

class FleetConsumptionTest(TestCase):
    def setUp(self):
        self.command = Command()

    def test_handle_subscription_request_new_agency(self):
        """Test que la réception d'un événement pour une nouvelle agence crée l'agence et un abonnement d'essai."""
        payload = {
            "event_type": "SUBSCRIPTION_REQUEST",
            "agence_id": "AG-001",
            "agence_nom": "Test Agency",
            "contact_email": "test@agency.com",
            "contact_telephone": "123456789",
            "adresse": "Test Address",
        }

        self.command.handle_subscription_request(payload)

        # Vérifier l'agence
        agency = AgenceMere.objects.get(agence_id="AG-001")
        self.assertEqual(agency.nom, "Test Agency")
        self.assertEqual(agency.statut_global, "ACTIVE") # Activé par SubscriptionService.souscrire

        # Vérifier l'abonnement
        abonnement = Abonnement.objects.get(agence=agency)
        self.assertEqual(abonnement.plan, PlanChoices.ESSAI)
        self.assertEqual(abonnement.statut, StatutAbonnement.TRIAL)

    def test_handle_subscription_request_existing_agency_no_active_sub(self):
        """Test que la réception d'un événement pour une agence existante sans abonnement actif crée un abonnement d'essai."""
        agency = AgenceMere.objects.create(
            agence_id="AG-002",
            nom="Existing Agency",
            statut_global="EN_ATTENTE"
        )

        payload = {
            "event_type": "SUBSCRIPTION_REQUEST",
            "agence_id": "AG-002",
            "agence_nom": "Updated Name",
            "contact_email": "updated@agency.com",
        }

        self.command.handle_subscription_request(payload)

        # Vérifier l'agence mise à jour
        agency.refresh_from_db()
        self.assertEqual(agency.nom, "Updated Name")
        self.assertEqual(agency.statut_global, "ACTIVE")

        # Vérifier l'abonnement
        abonnement = Abonnement.objects.get(agence=agency)
        self.assertEqual(abonnement.plan, PlanChoices.ESSAI)

    def test_handle_subscription_request_existing_agency_with_active_sub(self):
        """Test que la réception d'un événement pour une agence avec abonnement actif ne crée pas de nouvel abonnement."""
        from subscriptions.service import SubscriptionService
        
        agency = AgenceMere.objects.create(
            agence_id="AG-003",
            nom="Active Agency"
        )
        # Créer un abonnement actif (ex: MENSUEL)
        SubscriptionService.souscrire(agency, PlanChoices.MENSUEL)
        
        initial_sub_count = Abonnement.objects.filter(agence=agency).count()

        payload = {
            "event_type": "SUBSCRIPTION_REQUEST",
            "agence_id": "AG-003",
            "agence_nom": "Active Agency",
        }

        self.command.handle_subscription_request(payload)

        # Vérifier que le nombre d'abonnements n'a pas augmenté (ou que le plan n'a pas changé en ESSAI)
        self.assertEqual(Abonnement.objects.filter(agence=agency).count(), initial_sub_count)
        current_sub = Abonnement.objects.filter(agence=agency).first()
        self.assertEqual(current_sub.plan, PlanChoices.MENSUEL)
