"""
Tests unitaires — AgenceMere (CRUD)
"""
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from agencies.models import AgenceMere


class AgenceCreateTest(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.url    = "/api/subscribe/agences"
        self.data   = {
            "agence_id":      "AGC-TEST-001",
            "nom":            "Test Voyages",
            "email_officiel": "test@voyages.cm",
            "telephone":      "+237600000001",
            "adresse":        "Douala, Cameroun",
        }

    def test_creer_agence_succes(self):
        response = self.client.post(self.url, self.data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["agence_id"],      "AGC-TEST-001")
        self.assertEqual(response.data["nom"],            "Test Voyages")
        self.assertEqual(response.data["statut_global"],  "EN_ATTENTE")

    def test_creer_agence_email_duplique(self):
        self.client.post(self.url, self.data, format="json")
        response = self.client.post(self.url, self.data, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_creer_agence_agence_id_duplique(self):
        self.client.post(self.url, self.data, format="json")
        data2 = self.data.copy()
        data2["email_officiel"] = "autre@voyages.cm"
        response = self.client.post(self.url, data2, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_creer_agence_champs_manquants(self):
        response = self.client.post(self.url, {"nom": "Incomplet"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_lister_agences(self):
        self.client.post(self.url, self.data, format="json")
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data), 1)

    def test_detail_agence(self):
        self.client.post(self.url, self.data, format="json")
        response = self.client.get(f"{self.url}/AGC-TEST-001")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["agence_id"], "AGC-TEST-001")

    def test_detail_agence_inexistante(self):
        response = self.client.get(f"{self.url}/AGC-INEXISTANT")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)