"""
Tests unitaires — API verify et modules (endpoints proxy-service)
"""
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from agencies.models import AgenceMere
from subscriptions.models import Abonnement, StatutAbonnement
from django.utils import timezone
from datetime import timedelta


class VerifyAbonnementTest(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.agence = AgenceMere.objects.create(
            agence_id="AGC-VERIFY-001",
            nom="Touristique Express",
            email_officiel="touristique@express.cm",
            telephone="+237622222222",
            adresse="Ngaoundéré",
        )

    def test_verify_agence_inexistante(self):
        response = self.client.get("/api/subscribe/verify/AGC-FANTOME")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_verify_apres_souscription(self):
        self.client.post(
            f"/api/subscribe/agences/{self.agence.agence_id}/souscrire",
            {"plan": "MENSUEL", "id_transaction_paiement": "TXN-V01"},
            format="json",
        )
        response = self.client.get(
            f"/api/subscribe/verify/{self.agence.agence_id}"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["statut"], "ACTIVE")
        self.assertEqual(response.data["plan"],   "MENSUEL")
        self.assertIn("modules",        response.data)
        self.assertIn("joursRestants",  response.data)
        self.assertIn("dateExpiration", response.data)

    def test_verify_abonnement_expire_mis_a_jour(self):
        """Un abonnement expiré doit être détecté et mis à jour en EXPIRED."""
        ab = Abonnement.objects.create(
            agence=self.agence,
            id_agence=self.agence.agence_id,
            plan="MENSUEL",
            date_debut=timezone.now() - timedelta(days=35),
            date_expiration=timezone.now() - timedelta(days=5),
            statut=StatutAbonnement.ACTIVE,
        )
        response = self.client.get(
            f"/api/subscribe/verify/{self.agence.agence_id}"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["statut"], "EXPIRED")
        ab.refresh_from_db()
        self.assertEqual(ab.statut, StatutAbonnement.EXPIRED)

    def test_verify_agence_bloquee(self):
        from core.cache.subscription_cache_manager import SubscriptionCacheManager
        SubscriptionCacheManager.bloquer_agence(self.agence.agence_id)
        response = self.client.get(
            f"/api/subscribe/verify/{self.agence.agence_id}"
        )
        self.assertEqual(response.data["statut"], "SUSPENDED")
        self.assertEqual(response.data["source"],  "redis")
        SubscriptionCacheManager.debloquer_agence(self.agence.agence_id)

    def test_modules_depuis_redis(self):
        self.client.post(
            f"/api/subscribe/agences/{self.agence.agence_id}/souscrire",
            {"plan": "MENSUEL", "id_transaction_paiement": "TXN-V02"},
            format="json",
        )
        # Premier appel charge Redis
        self.client.get(f"/api/subscribe/verify/{self.agence.agence_id}")
        # Deuxième appel doit venir de Redis
        response = self.client.get(
            f"/api/subscribe/modules/{self.agence.agence_id}"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["source"], "redis")
        self.assertIn("BOOKING", response.data["modules"])


class TableauDeBordTest(TestCase):

    def setUp(self):
        self.client = APIClient()

    def test_tableau_de_bord(self):
        response = self.client.get("/api/subscribe/tableau-de-bord")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("resume",                      response.data)
        self.assertIn("actifs",                      response.data["resume"])
        self.assertIn("essais",                      response.data["resume"])
        self.assertIn("expirant_sous_30j",           response.data["resume"])
        self.assertIn("recette_totale_fcfa",         response.data["resume"])
        self.assertIn("abonnements_expirant_bientot", response.data)

    def test_tableau_de_bord_recettes(self):
        agence = AgenceMere.objects.create(
            agence_id="AGC-BOARD-001",
            nom="Buca Voyages",
            email_officiel="buca@voyages.cm",
        )
        self.client.post(
            f"/api/subscribe/agences/{agence.agence_id}/souscrire",
            {"plan": "MENSUEL", "id_transaction_paiement": "TXN-B01"},
            format="json",
        )
        response = self.client.get("/api/subscribe/tableau-de-bord")
        self.assertGreaterEqual(response.data["resume"]["recette_totale_fcfa"], 50000)
        self.assertGreaterEqual(response.data["resume"]["actifs"], 1)