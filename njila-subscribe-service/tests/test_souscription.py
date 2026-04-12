"""
Tests unitaires — Souscription, Renouvellement, Suspension, Réactivation
"""
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from agencies.models import AgenceMere
from subscriptions.models import Abonnement, StatutAbonnement, ModuleAutorise


class SouscriptionTest(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.agence = AgenceMere.objects.create(
            agence_id="AGC-SUB-001",
            nom="Binam Voyages",
            email_officiel="binam@voyages.cm",
            telephone="+237611111111",
            adresse="Bafoussam",
        )

    # ── Essai ─────────────────────────────────────────────────────────────────

    def test_demande_essai_succes(self):
        response = self.client.post(
            f"/api/subscribe/agences/{self.agence.agence_id}/demande-essai"
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["plan"],   "ESSAI")
        self.assertEqual(response.data["statut"], "TRIAL")
        self.assertIn("cle_privee_pem", response.data)
        self.assertIn("-----BEGIN PRIVATE KEY-----", response.data["cle_privee_pem"])

    def test_demande_essai_double_refus(self):
        self.client.post(f"/api/subscribe/agences/{self.agence.agence_id}/demande-essai")
        response = self.client.post(
            f"/api/subscribe/agences/{self.agence.agence_id}/demande-essai"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Essai", response.data["detail"])

    def test_demande_essai_modules_corrects(self):
        self.client.post(f"/api/subscribe/agences/{self.agence.agence_id}/demande-essai")
        ab      = Abonnement.objects.get(agence=self.agence, plan="ESSAI")
        modules = list(ModuleAutorise.objects.filter(abonnement=ab).values_list("nom_module", flat=True))
        self.assertIn("BOOKING", modules)
        self.assertIn("SEARCH",  modules)
        self.assertIn("FLEET",   modules)

    def test_demande_essai_duree_15_jours(self):
        self.client.post(f"/api/subscribe/agences/{self.agence.agence_id}/demande-essai")
        response = self.client.post(
            f"/api/subscribe/agences/{self.agence.agence_id}/demande-essai"
        )
        ab = Abonnement.objects.get(agence=self.agence, plan="ESSAI")
        self.assertAlmostEqual(ab.jours_restants(), 14, delta=1)

    # ── Plans payants ─────────────────────────────────────────────────────────

    def test_souscrire_mensuel(self):
        response = self.client.post(
            f"/api/subscribe/agences/{self.agence.agence_id}/souscrire",
            {"plan": "MENSUEL", "id_transaction_paiement": "TXN-001"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["plan"],   "MENSUEL")
        self.assertEqual(response.data["statut"], "ACTIVE")
        self.assertIn("cle_privee_pem", response.data)
        self.assertIn("cle_chiffree",   response.data)

    def test_souscrire_trimestriel(self):
        response = self.client.post(
            f"/api/subscribe/agences/{self.agence.agence_id}/souscrire",
            {"plan": "TRIMESTRIEL", "id_transaction_paiement": "TXN-002"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["plan"], "TRIMESTRIEL")
        ab = Abonnement.objects.get(agence=self.agence, plan="TRIMESTRIEL")
        self.assertAlmostEqual(ab.jours_restants(), 89, delta=1)

    def test_souscrire_annuel(self):
        response = self.client.post(
            f"/api/subscribe/agences/{self.agence.agence_id}/souscrire",
            {"plan": "ANNUEL", "id_transaction_paiement": "TXN-003"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["plan"], "ANNUEL")
        ab = Abonnement.objects.get(agence=self.agence, plan="ANNUEL")
        self.assertAlmostEqual(ab.jours_restants(), 364, delta=1)

    def test_souscrire_plan_invalide(self):
        response = self.client.post(
            f"/api/subscribe/agences/{self.agence.agence_id}/souscrire",
            {"plan": "INEXISTANT"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_souscrire_agence_inexistante(self):
        response = self.client.post(
            "/api/subscribe/agences/AGC-FANTOME/souscrire",
            {"plan": "MENSUEL"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_souscrire_cloture_abonnement_precedent(self):
        """Une nouvelle souscription clôture l'abonnement actif précédent."""
        self.client.post(
            f"/api/subscribe/agences/{self.agence.agence_id}/souscrire",
            {"plan": "MENSUEL", "id_transaction_paiement": "TXN-004"},
            format="json",
        )
        self.client.post(
            f"/api/subscribe/agences/{self.agence.agence_id}/souscrire",
            {"plan": "ANNUEL", "id_transaction_paiement": "TXN-005"},
            format="json",
        )
        resilies = Abonnement.objects.filter(
            agence=self.agence, statut=StatutAbonnement.RESILIATION
        )
        self.assertEqual(resilies.count(), 1)
        self.assertEqual(resilies.first().plan, "MENSUEL")

    # ── Renouvellement ────────────────────────────────────────────────────────

    def test_renouveler_abonnement(self):
        self.client.post(
            f"/api/subscribe/agences/{self.agence.agence_id}/souscrire",
            {"plan": "MENSUEL", "id_transaction_paiement": "TXN-006"},
            format="json",
        )
        response = self.client.post(
            f"/api/subscribe/agences/{self.agence.agence_id}/renouveler",
            {"plan": "ANNUEL", "id_transaction_paiement": "TXN-007"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["plan"],   "ANNUEL")
        self.assertEqual(response.data["statut"], "ACTIVE")

    def test_renouveler_revoque_ancienne_cle(self):
        from subscriptions.models import CleActivation
        self.client.post(
            f"/api/subscribe/agences/{self.agence.agence_id}/souscrire",
            {"plan": "MENSUEL", "id_transaction_paiement": "TXN-008"},
            format="json",
        )
        ab = Abonnement.objects.get(agence=self.agence, plan="MENSUEL")
        self.client.post(
            f"/api/subscribe/agences/{self.agence.agence_id}/renouveler",
            {"plan": "ANNUEL", "id_transaction_paiement": "TXN-009"},
            format="json",
        )
        cles_revoquees = CleActivation.objects.filter(abonnement=ab, revoquee=True)
        self.assertGreater(cles_revoquees.count(), 0)

    # ── Suspension ────────────────────────────────────────────────────────────

    def test_suspendre_agence(self):
        self.client.post(
            f"/api/subscribe/agences/{self.agence.agence_id}/souscrire",
            {"plan": "MENSUEL", "id_transaction_paiement": "TXN-010"},
            format="json",
        )
        response = self.client.post(
            f"/api/subscribe/agences/{self.agence.agence_id}/suspendre",
            {"motif": "Impayé 30 jours", "admin_id": "ADMIN-001"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["statut"], "SUSPENDED")

    def test_suspendre_sans_motif(self):
        self.client.post(
            f"/api/subscribe/agences/{self.agence.agence_id}/souscrire",
            {"plan": "MENSUEL", "id_transaction_paiement": "TXN-011"},
            format="json",
        )
        response = self.client.post(
            f"/api/subscribe/agences/{self.agence.agence_id}/suspendre",
            {"admin_id": "ADMIN-001"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # ── Réactivation ──────────────────────────────────────────────────────────

    def test_reactiver_agence(self):
        self.client.post(
            f"/api/subscribe/agences/{self.agence.agence_id}/souscrire",
            {"plan": "MENSUEL", "id_transaction_paiement": "TXN-012"},
            format="json",
        )
        self.client.post(
            f"/api/subscribe/agences/{self.agence.agence_id}/suspendre",
            {"motif": "Test", "admin_id": "ADMIN-001"},
            format="json",
        )
        response = self.client.post(
            f"/api/subscribe/agences/{self.agence.agence_id}/reactiver",
            {"plan": "MENSUEL", "id_transaction_paiement": "TXN-013"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["statut"], "ACTIVE")