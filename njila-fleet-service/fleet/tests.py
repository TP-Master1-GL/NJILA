"""
Script de test pour le fleet-management-service NJILA
"""

import requests
import json
import sys
from datetime import datetime

BASE_URL = "http://localhost:8088/api"
GREEN = '\033[0;32m'
RED = '\033[0;31m'
BLUE = '\033[0;34m'
YELLOW = '\033[1;33m'
NC = '\033[0m'

class TestFleetService:
    def __init__(self):
        self.base_url = BASE_URL
        self.tests_passed = 0
        self.tests_total = 0
        self.bus_id = None
        self.test_immat = f"TEST{datetime.now().strftime('%H%M%S')}"
    
    def print_header(self, title):
        print(f"\n{BLUE}═══════════════════════════════════════════════════════════════{NC}")
        print(f"{BLUE}   {title}{NC}")
        print(f"{BLUE}═══════════════════════════════════════════════════════════════{NC}\n")
    
    def print_result(self, test_name, success, response=None):
        self.tests_total += 1
        if success:
            print(f"{GREEN}✅ {test_name}: SUCCÈS{NC}")
            self.tests_passed += 1
        else:
            print(f"{RED}❌ {test_name}: ÉCHEC{NC}")
            if response:
                print(f"{YELLOW}   Réponse: {response[:200]}{NC}")
    
    def test_get_all_buses(self):
        """TEST 1: GET tous les bus"""
        print(f"{BLUE}[TEST 1] GET /bus/ - Liste tous les bus{NC}")
        try:
            response = requests.get(f"{self.base_url}/bus/")
            success = response.status_code == 200
            self.print_result("GET /bus/", success, response.text)
            if success:
                buses = response.json()
                print(f"   ✓ Nombre de bus: {len(buses) if isinstance(buses, list) else 0}")
            return success
        except Exception as e:
            self.print_result("GET /bus/", False, str(e))
            return False
    
    def test_get_by_agence(self):
        """TEST 2: GET avec filtre par agence"""
        print(f"\n{BLUE}[TEST 2] GET /bus/?agence=General Voyages{NC}")
        try:
            response = requests.get(f"{self.base_url}/bus/", params={"agence": "General Voyages"})
            success = response.status_code == 200
            self.print_result("GET /bus/?agence=General Voyages", success, response.text)
            return success
        except Exception as e:
            self.print_result("GET /bus/?agence=General Voyages", False, str(e))
            return False
    
    def test_get_by_status(self):
        """TEST 3: GET avec filtre par statut"""
        print(f"\n{BLUE}[TEST 3] GET /bus/?status=disponible{NC}")
        try:
            response = requests.get(f"{self.base_url}/bus/", params={"status": "disponible"})
            success = response.status_code == 200
            self.print_result("GET /bus/?status=disponible", success, response.text)
            return success
        except Exception as e:
            self.print_result("GET /bus/?status=disponible", False, str(e))
            return False
    
    def test_get_disponibles(self):
        """TEST 4: GET bus disponibles"""
        print(f"\n{BLUE}[TEST 4] GET /bus/disponibles/{NC}")
        try:
            response = requests.get(f"{self.base_url}/bus/disponibles/")
            success = response.status_code == 200
            self.print_result("GET /bus/disponibles/", success, response.text)
            return success
        except Exception as e:
            self.print_result("GET /bus/disponibles/", False, str(e))
            return False
    
    def test_create_bus(self):
        """TEST 5: POST - Créer un bus"""
        print(f"\n{BLUE}[TEST 5] POST /bus/ - Création d'un bus{NC}")
        try:
            data = {
                "immatriculation": self.test_immat,
                "modele": "Coaster",
                "marque": "Toyota",
                "capacite": 45,
                "classe": "vip",
                "status": "disponible",
                "agence": "General Voyages"
            }
            response = requests.post(f"{self.base_url}/bus/", json=data)
            success = response.status_code in [200, 201]
            self.print_result("POST /bus/", success, response.text)
            if success:
                self.bus_id = response.json().get('id')
                print(f"   ✓ Bus créé avec ID: {self.bus_id}")
                print(f"   ✓ Immatriculation: {self.test_immat}")
            return success
        except Exception as e:
            self.print_result("POST /bus/", False, str(e))
            return False
    
    def test_get_bus_detail(self):
        """TEST 6: GET détail d'un bus"""
        if not self.bus_id:
            print(f"\n{YELLOW}[TEST 6] SKIP - Pas de bus créé{NC}")
            self.tests_total += 1
            return False
        
        print(f"\n{BLUE}[TEST 6] GET /bus/{self.bus_id}/{NC}")
        try:
            response = requests.get(f"{self.base_url}/bus/{self.bus_id}/")
            success = response.status_code == 200
            self.print_result(f"GET /bus/{self.bus_id}/", success, response.text)
            return success
        except Exception as e:
            self.print_result(f"GET /bus/{self.bus_id}/", False, str(e))
            return False
    
    def test_update_bus(self):
        """TEST 7: PUT - Mettre à jour un bus"""
        if not self.bus_id:
            print(f"\n{YELLOW}[TEST 7] SKIP - Pas de bus créé{NC}")
            self.tests_total += 1
            return False
        
        print(f"\n{BLUE}[TEST 7] PUT /bus/{self.bus_id}/{NC}")
        try:
            data = {
                "immatriculation": self.test_immat,
                "modele": "Coaster Luxe",
                "marque": "Toyota",
                "capacite": 45,
                "classe": "luxe",
                "status": "disponible",
                "agence": "General Voyages"
            }
            response = requests.put(f"{self.base_url}/bus/{self.bus_id}/", json=data)
            success = response.status_code == 200
            self.print_result(f"PUT /bus/{self.bus_id}/", success, response.text)
            return success
        except Exception as e:
            self.print_result(f"PUT /bus/{self.bus_id}/", False, str(e))
            return False
    
    def test_update_status(self):
        """TEST 8: PUT - Changer le statut"""
        if not self.bus_id:
            print(f"\n{YELLOW}[TEST 8] SKIP - Pas de bus créé{NC}")
            self.tests_total += 1
            return False
        
        print(f"\n{BLUE}[TEST 8] PUT /bus/{self.bus_id}/etat/{NC}")
        try:
            response = requests.put(
                f"{self.base_url}/bus/{self.bus_id}/etat/",
                json={"status": "en_voyage"}
            )
            success = response.status_code == 200
            self.print_result(f"PUT /bus/{self.bus_id}/etat/", success, response.text)
            if success:
                print(f"   ✓ Nouveau statut: en_voyage")
            return success
        except Exception as e:
            self.print_result(f"PUT /bus/{self.bus_id}/etat/", False, str(e))
            return False
    
    def test_search(self):
        """TEST 9: GET avec recherche"""
        print(f"\n{BLUE}[TEST 9] GET /bus/?search=Toyota{NC}")
        try:
            response = requests.get(f"{self.base_url}/bus/", params={"search": "Toyota"})
            success = response.status_code == 200
            self.print_result("GET /bus/?search=Toyota", success, response.text)
            return success
        except Exception as e:
            self.print_result("GET /bus/?search=Toyota", False, str(e))
            return False
    
    def test_stats_global(self):
        """TEST 10: GET statistiques globales"""
        print(f"\n{BLUE}[TEST 10] GET /stats/{NC}")
        try:
            response = requests.get(f"{self.base_url}/stats/")
            success = response.status_code == 200
            self.print_result("GET /stats/", success, response.text)
            if success:
                data = response.json()
                print(f"   ✓ Total bus: {data.get('total_bus', 0)}")
            return success
        except Exception as e:
            self.print_result("GET /stats/", False, str(e))
            return False
    
    def test_stats_by_agence(self):
        """TEST 11: GET statistiques par agence"""
        print(f"\n{BLUE}[TEST 11] GET /stats/?agence=General Voyages{NC}")
        try:
            response = requests.get(f"{self.base_url}/stats/", params={"agence": "General Voyages"})
            success = response.status_code == 200
            self.print_result("GET /stats/?agence=General Voyages", success, response.text)
            return success
        except Exception as e:
            self.print_result("GET /stats/?agence=General Voyages", False, str(e))
            return False
    
    def test_pagination(self):
        """TEST 12: GET avec pagination"""
        print(f"\n{BLUE}[TEST 12] GET /bus/?page=1&page_size=5{NC}")
        try:
            response = requests.get(f"{self.base_url}/bus/", params={"page": 1, "page_size": 5})
            success = response.status_code == 200
            self.print_result("GET /bus/?page=1&page_size=5", success, response.text)
            return success
        except Exception as e:
            self.print_result("GET /bus/?page=1&page_size=5", False, str(e))
            return False
    
    def test_delete_bus(self):
        """TEST 13: DELETE - Supprimer le bus"""
        if not self.bus_id:
            print(f"\n{YELLOW}[TEST 13] SKIP - Pas de bus à supprimer{NC}")
            self.tests_total += 1
            return False
        
        print(f"\n{BLUE}[TEST 13] DELETE /bus/{self.bus_id}/{NC}")
        try:
            response = requests.delete(f"{self.base_url}/bus/{self.bus_id}/")
            success = response.status_code == 204
            self.print_result(f"DELETE /bus/{self.bus_id}/", success, response.text)
            return success
        except Exception as e:
            self.print_result(f"DELETE /bus/{self.bus_id}/", False, str(e))
            return False
    
    def test_verify_deletion(self):
        """TEST 14: Vérifier la suppression"""
        if not self.bus_id:
            print(f"\n{YELLOW}[TEST 14] SKIP - Pas de bus à vérifier{NC}")
            self.tests_total += 1
            return False
        
        print(f"\n{BLUE}[TEST 14] GET /bus/{self.bus_id}/ - Vérification suppression{NC}")
        try:
            response = requests.get(f"{self.base_url}/bus/{self.bus_id}/")
            success = response.status_code == 404
            self.print_result("Vérification suppression", success, response.text)
            if success:
                print(f"   ✓ Bus non trouvé - Suppression confirmée")
            return success
        except Exception as e:
            self.print_result("Vérification suppression", False, str(e))
            return False
    
    def run_all_tests(self):
        """Exécuter tous les tests"""
        self.print_header("TEST DU FLEET-MANAGEMENT-SERVICE - BUS")
        print(f"{YELLOW}URL de base: {self.base_url}{NC}\n")
        
        # Exécuter tous les tests
        self.test_get_all_buses()
        self.test_get_by_agence()
        self.test_get_by_status()
        self.test_get_disponibles()
        self.test_create_bus()
        self.test_get_bus_detail()
        self.test_update_bus()
        self.test_update_status()
        self.test_search()
        self.test_stats_global()
        self.test_stats_by_agence()
        self.test_pagination()
        self.test_delete_bus()
        self.test_verify_deletion()
        
        # Afficher les résultats
        self.print_header("RÉSULTATS DES TESTS")
        print(f"Total des tests: {BLUE}{self.tests_total}{NC}")
        print(f"Tests réussis:   {GREEN}{self.tests_passed}{NC}")
        print(f"Tests échoués:    {RED}{self.tests_total - self.tests_passed}{NC}")
        
        if self.tests_total > 0:
            percentage = (self.tests_passed * 100 // self.tests_total)
            print(f"Taux de réussite: {YELLOW}{percentage}%{NC}")
        
        self.print_header("ENDPOINTS TESTÉS")
        endpoints = [
            "GET    /bus/",
            "GET    /bus/?agence=:agence",
            "GET    /bus/?status=:status",
            "GET    /bus/disponibles/",
            "GET    /bus/:id/",
            "GET    /bus/?search=:term",
            "GET    /stats/",
            "GET    /stats/?agence=:agence",
            "POST   /bus/",
            "PUT    /bus/:id/",
            "PUT    /bus/:id/etat/",
            "DELETE /bus/:id/"
        ]
        for endpoint in endpoints:
            print(f"{GREEN}✅ {endpoint}{NC}")
        
        return self.tests_passed == self.tests_total

if __name__ == "__main__":
    tester = TestFleetService()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)