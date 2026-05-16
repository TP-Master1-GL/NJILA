#!/usr/bin/env python3
"""
Script de test pour vérifier la communication RabbitMQ entre les services
"""

import pika
import json
import sys
import time
import threading
import requests
from datetime import datetime

# Configuration
RABBITMQ_HOST = 'localhost'
RABBITMQ_PORT = 5672
RABBITMQ_USER = 'guest'
RABBITMQ_PASSWORD = 'guest'
FLEET_SERVICE_URL = 'http://localhost:8088/api'
AUTH_SERVICE_URL = 'http://localhost:8081/api'

# Token (à remplacer par un token valide)
TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5YjBiNGM2Ny02YTI0LTQyZTAtOWEzZS0wOTY2NDRhNmVmM2MiLCJyb2xlIjoiQURNSU5JU1RSQVRFVVIiLCJzZXNzaW9uX2lkIjoiNmM2NGYxMTUtNjU4ZS00NzYyLWJlNGUtNzA0ODA4NWIwYzBkIiwiZmlsaWFsZV9pZCI6bnVsbCwiYWdlbmNlX2lkIjpudWxsLCJpYXQiOjE3NzU1NjgzOTgsImV4cCI6MTc3NTU2OTI5OCwianRpIjoiNDZiOTI2YmItNDRmNy00YWY3LTkwZTItOGEzZTg0ZTAyMTkzIn0.7IA3PwdCjPWtW6QbqNeSOXC-SU7R3srXpLcfYv1pj7o"

# Variables pour stocker les résultats
received_messages = {
    'njila.fleet.exchange': [],
    'njila.subscribe.exchange': [],
    'njila.user.exchange': [],
    'njila.booking.exchange': []
}

class RabbitMQMonitor:
    """Moniteur RabbitMQ pour écouter tous les échanges"""
    
    def __init__(self):
        self.connection = None
        self.channel = None
        self.stop_flag = False
        
    def connect(self):
        """Connexion à RabbitMQ"""
        try:
            credentials = pika.PlainCredentials(RABBITMQ_USER, RABBITMQ_PASSWORD)
            parameters = pika.ConnectionParameters(
                host=RABBITMQ_HOST,
                port=RABBITMQ_PORT,
                credentials=credentials,
                heartbeat=600
            )
            self.connection = pika.BlockingConnection(parameters)
            self.channel = self.connection.channel()
            print("✅ Connecté à RabbitMQ")
            return True
        except Exception as e:
            print(f"❌ Erreur de connexion à RabbitMQ: {e}")
            return False
    
    def declare_exchanges(self):
        """Déclarer les exchanges pour vérification"""
        exchanges = [
            'njila.fleet.exchange',
            'njila.subscribe.exchange',
            'njila.user.exchange',
            'njila.booking.exchange',
            'njila.dead.letter.exchange'
        ]
        
        print("\n📡 Vérification des exchanges:")
        for exchange in exchanges:
            try:
                self.channel.exchange_declare(
                    exchange=exchange,
                    exchange_type='topic',
                    durable=True,
                    passive=True  # Ne pas créer si n'existe pas
                )
                print(f"  ✅ Exchange existe: {exchange}")
            except:
                print(f"  ❌ Exchange n'existe pas: {exchange}")
    
    def monitor_queue(self, queue_name, exchange, routing_key):
        """Surveiller une queue spécifique"""
        try:
            # Déclarer la queue
            result = self.channel.queue_declare(queue=queue_name, durable=True, passive=True)
            queue_length = result.method.message_count
            print(f"  📊 Queue '{queue_name}' - Messages en attente: {queue_length}")
            
            # Consommer les messages existants
            messages = []
            for method, properties, body in self.channel.consume(queue_name, inactivity_timeout=1):
                if body:
                    message = json.loads(body)
                    messages.append({
                        'routing_key': method.routing_key,
                        'exchange': exchange,
                        'queue': queue_name,
                        'body': message,
                        'timestamp': datetime.now().isoformat()
                    })
                    self.channel.basic_ack(method.delivery_tag)
                else:
                    break
            
            return messages
        except Exception as e:
            print(f"  ⚠️ Erreur monitoring queue {queue_name}: {e}")
            return []
    
    def get_all_messages(self):
        """Récupérer tous les messages des queues du fleet-service"""
        queues = [
            ('njila.fleet.subscription.queue', 'njila.subscribe.exchange', 'subscription.*'),
            ('njila.fleet.user.queue', 'njila.user.exchange', 'user.*'),
            ('njila.fleet.booking.queue', 'njila.booking.exchange', 'reservation.*')
        ]
        
        all_messages = []
        for queue, exchange, routing_key in queues:
            messages = self.monitor_queue(queue, exchange, routing_key)
            all_messages.extend(messages)
        
        return all_messages
    
    def close(self):
        """Fermer la connexion"""
        if self.connection and not self.connection.is_closed:
            self.connection.close()
            print("\n🔌 Connexion RabbitMQ fermée")

def test_fleet_service_events():
    """Tester la publication d'événements par le fleet-service"""
    print("\n" + "="*60)
    print("🚀 TEST: Publication d'événements par le fleet-service")
    print("="*60)
    
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {TOKEN}'
    }
    
    # 1. Créer une agence
    print("\n1️⃣ Création d'une agence...")
    agence_data = {
        "name": "Test RabbitMQ SA",
        "adresse": "123 Test Street, Douala",
        "telephone": "699999999",
        "email_officiel": f"test_{int(time.time())}@rabbitmq.cm",
        "statut_global": "active"
    }
    
    response = requests.post(
        f"{FLEET_SERVICE_URL}/agences/",
        json=agence_data,
        headers=headers
    )
    
    if response.status_code == 201:
        agence = response.json()
        print(f"  ✅ Agence créée: {agence.get('name')} (ID: {agence.get('id_agence')})")
        agence_id = agence.get('id_agence')
    else:
        print(f"  ❌ Erreur création agence: {response.status_code} - {response.text}")
        return None
    
    # 2. Créer une filiale
    print("\n2️⃣ Création d'une filiale...")
    filiale_data = {
        "nom": "Agence Test Douala",
        "code": "TST-DLA-01",
        "ville": "Douala",
        "adresse": "123 Test Street, Douala",
        "telephone": "699999990",
        "email": f"test_{int(time.time())}@filiale.cm",
        "est_active": True,
        "agence": agence_id
    }
    
    response = requests.post(
        f"{FLEET_SERVICE_URL}/filiales/",
        json=filiale_data,
        headers=headers
    )
    
    if response.status_code == 201:
        filiale = response.json()
        print(f"  ✅ Filiale créée: {filiale.get('nom')} (ID: {filiale.get('id_filiale')})")
        filiale_id = filiale.get('id_filiale')
    else:
        print(f"  ❌ Erreur création filiale: {response.status_code} - {response.text}")
        return None
    
    # 3. Créer un bus
    print("\n3️⃣ Création d'un bus...")
    bus_data = {
        "immatriculation": f"LT {int(time.time())} AB",
        "modele": "Test Bus",
        "capacite": 50,
        "etat": "disponible",
        "Id_agence": agence_id
    }
    
    response = requests.post(
        f"{FLEET_SERVICE_URL}/bus/",
        json=bus_data,
        headers=headers
    )
    
    if response.status_code == 201:
        bus = response.json()
        print(f"  ✅ Bus créé: {bus.get('immatriculation')} (ID: {bus.get('IdBus')})")
        bus_id = bus.get('IdBus')
    else:
        print(f"  ❌ Erreur création bus: {response.status_code} - {response.text}")
        bus_id = None
    
    # 4. Créer un chauffeur
    print("\n4️⃣ Création d'un chauffeur...")
    chauffeur_data = {
        "numero_permis": f"P{int(time.time())}",
        "name": "Jean",
        "surname": "Test",
        "email": f"test_{int(time.time())}@chauffeur.cm",
        "phone": "677777777",
        "Adresse": "Test Address",
        "date_embauche": "2024-01-01",
        "Id_agence": agence_id,
        "est_disponible": True
    }
    
    response = requests.post(
        f"{FLEET_SERVICE_URL}/chauffeurs/",
        json=chauffeur_data,
        headers=headers
    )
    
    if response.status_code == 201:
        chauffeur = response.json()
        print(f"  ✅ Chauffeur créé: {chauffeur.get('name')} {chauffeur.get('surname')} (ID: {chauffeur.get('id_chauffeur')})")
        chauffeur_id = chauffeur.get('id_chauffeur')
    else:
        print(f"  ❌ Erreur création chauffeur: {response.status_code} - {response.text}")
        chauffeur_id = None
    
    return {
        'agence_id': agence_id,
        'filiale_id': filiale_id,
        'bus_id': bus_id,
        'chauffeur_id': chauffeur_id
    }

def check_rabbitmq_status():
    """Vérifier l'état de RabbitMQ"""
    print("\n" + "="*60)
    print("🔍 VÉRIFICATION: État de RabbitMQ")
    print("="*60)
    
    monitor = RabbitMQMonitor()
    
    if not monitor.connect():
        print("❌ Impossible de se connecter à RabbitMQ")
        return False
    
    # Déclarer les exchanges
    monitor.declare_exchanges()
    
    # Lister les queues
    print("\n📋 Queues du fleet-service:")
    queues = monitor.get_all_messages()
    
    if queues:
        print(f"\n📨 Messages trouvés dans les queues:")
        for msg in queues:
            print(f"\n  📍 Queue: {msg['queue']}")
            print(f"  🏷️  Routing key: {msg['routing_key']}")
            print(f"  📦 Event type: {msg['body'].get('event_type')}")
            print(f"  📄 Contenu: {json.dumps(msg['body'], indent=4, default=str)[:500]}")
    else:
        print("\n  ℹ️ Aucun message trouvé dans les queues")
    
    monitor.close()
    return True

def publish_test_message():
    """Publier un message de test direct"""
    print("\n" + "="*60)
    print("📤 TEST: Publication directe de message")
    print("="*60)
    
    try:
        credentials = pika.PlainCredentials(RABBITMQ_USER, RABBITMQ_PASSWORD)
        parameters = pika.ConnectionParameters(
            host=RABBITMQ_HOST,
            port=RABBITMQ_PORT,
            credentials=credentials
        )
        connection = pika.BlockingConnection(parameters)
        channel = connection.channel()
        
        # Message de test
        test_message = {
            'event_type': 'TEST_MESSAGE',
            'service': 'fleet-service',
            'timestamp': datetime.now().isoformat(),
            'data': {
                'test': True,
                'message': 'Ceci est un message de test'
            }
        }
        
        # Publier sur l'exchange du fleet
        channel.basic_publish(
            exchange='njila.fleet.exchange',
            routing_key='test.message',
            body=json.dumps(test_message),
            properties=pika.BasicProperties(
                delivery_mode=2,
                content_type='application/json'
            )
        )
        
        print("✅ Message de test publié sur 'njila.fleet.exchange'")
        print(f"   Routing key: test.message")
        print(f"   Message: {test_message}")
        
        connection.close()
        return True
        
    except Exception as e:
        print(f"❌ Erreur publication message test: {e}")
        return False

def verify_consumer_status():
    """Vérifier que le consumer tourne"""
    print("\n" + "="*60)
    print("🔧 VÉRIFICATION: Consumer RabbitMQ")
    print("="*60)
    
    # Vérifier si le processus Python a le consumer actif
    try:
        import subprocess
        result = subprocess.run(
            ["ps", "aux"],
            capture_output=True,
            text=True
        )
        
        if "python" in result.stdout and "runserver" in result.stdout:
            print("✅ Le serveur Django semble tourner")
            print("   Vérifiez les logs pour: 'Consumer RabbitMQ démarré'")
        else:
            print("⚠️ Le serveur Django ne semble pas tourner")
            
    except Exception as e:
        print(f"⚠️ Impossible de vérifier le process: {e}")
    
    print("\n💡 Pour voir les logs du consumer:")
    print("   - Regardez la console où tourne le serveur Django")
    print("   - Cherchez: '✅ Consumer RabbitMQ démarré'")
    print("   - Cherchez les messages 'Message publié:'")

def main():
    """Fonction principale"""
    print("="*60)
    print("🐇 TEST DE COMMUNICATION RABBITMQ")
    print("="*60)
    print(f"RabbitMQ: {RABBITMQ_HOST}:{RABBITMQ_PORT}")
    print(f"Fleet Service: {FLEET_SERVICE_URL}")
    print("="*60)
    
    # 1. Vérifier l'état de RabbitMQ
    check_rabbitmq_status()
    
    # 2. Vérifier le consumer
    verify_consumer_status()
    
    # 3. Publier un message de test
    publish_test_message()
    
    # 4. Attendre un peu
    print("\n⏳ Attente de 5 secondes pour que les messages soient traités...")
    time.sleep(5)
    
    # 5. Vérifier à nouveau les queues
    check_rabbitmq_status()
    
    # 6. Option: Tester avec le fleet-service
    print("\n" + "="*60)
    print("❓ Voulez-vous tester la création d'entités dans le fleet-service? (o/n)")
    response = input("> ")
    
    if response.lower() == 'o':
        print("\n⏳ Création des entités de test...")
        results = test_fleet_service_events()
        if results:
            print("\n✅ Entités créées avec succès!")
            print(f"   Agence ID: {results['agence_id']}")
            print(f"   Filiale ID: {results['filiale_id']}")
            
            # Attendre que les messages soient publiés
            print("\n⏳ Attente de 3 secondes pour la publication des événements...")
            time.sleep(3)
            
            # Vérifier les messages
            check_rabbitmq_status()
    
    print("\n" + "="*60)
    print("✅ Test terminé!")
    print("="*60)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n👋 Test interrompu par l'utilisateur")
        sys.exit(0)
    except Exception as e:
        print(f"\n❌ Erreur: {e}")
        sys.exit(1)