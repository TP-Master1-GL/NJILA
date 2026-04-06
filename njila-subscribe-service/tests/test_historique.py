"""
Tests unitaires — Historique et traçabilité
"""
from django.test import TestCase
from rest_framework.test import APIClient
from agencies.models import AgenceMere
from subscriptions.models import HistoriqueAbonnement, Abonnement


class HistoriqueTest(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.agence = AgenceMere.objects.create(
            agence_id="AGC-HIST-001",
            nom="Buca Express",
            email_officiel="buca@express.cm",
            telephone="+237633333333",
            adresse="Bertoua",
        )

    def test_historique_souscription_cree(self):
        self.client.post(
            f"/api/subscribe/agences/{self.agence.agence_id}/souscrire",
            {"plan": "MENSUEL", "id_transaction_paiement": "TXN-H01"},
            format="json",
        )
        ab      = Abonnement.objects.get(agence=self.agence)
        entries = HistoriqueAbonnement.objects.filter(abonnement=ab)
        self.assertEqual(entries.count(), 1)
        self.assertEqual(entries.first().action, "SOUSCRIPTION")

    def test_historique_suspension_tracee(self):
        self.client.post(
            f"/api/subscribe/agences/{self.agence.agence_id}/souscrire",
            {"plan": "MENSUEL", "id_transaction_paiement": "TXN-H02"},
            format="json",
        )
        self.client.post(
            f"/api/subscribe/agences/{self.agence.agence_id}/suspendre",
            {"motif": "Fraude détectée", "admin_id": "ADMIN-001"},
            format="json",
        )
        ab      = Abonnement.objects.get(agence=self.agence)
        actions = list(HistoriqueAbonnement.objects.filter(
            abonnement=ab
        ).values_list("action", flat=True))
        self.assertIn("SOUSCRIPTION", actions)
        self.assertIn("SUSPENSION",   actions)

    def test_historique_renouvellement_trace(self):
        self.client.post(
            f"/api/subscribe/agences/{self.agence.agence_id}/souscrire",
            {"plan": "MENSUEL", "id_transaction_paiement": "TXN-H03"},
            format="json",
        )
        self.client.post(
            f"/api/subscribe/agences/{self.agence.agence_id}/renouveler",
            {"plan": "ANNUEL", "id_transaction_paiement": "TXN-H04"},
            format="json",
        )
        ab      = Abonnement.objects.get(agence=self.agence, plan="ANNUEL")
        actions = list(HistoriqueAbonnement.objects.filter(
            abonnement=ab
        ).values_list("action", flat=True))
        self.assertIn("RENOUVELLEMENT", actions)

    def test_detail_agence_contient_historique(self):
        self.client.post(
            f"/api/subscribe/agences/{self.agence.agence_id}/souscrire",
            {"plan": "MENSUEL", "id_transaction_paiement": "TXN-H05"},
            format="json",
        )
        response = self.client.get(
            f"/api/subscribe/agences/{self.agence.agence_id}"
        )
        historique = response.data["abonnement_actuel"]["historique"]
        self.assertGreater(len(historique), 0)
        self.assertEqual(historique[0]["action"], "SOUSCRIPTION")