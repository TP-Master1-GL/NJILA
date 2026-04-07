#!/usr/bin/env python
"""
Test d'intégration pour vérifier les communications inter-services
"""

import os
import sys
import json
import time
import uuid
import pika
import requests
import threading
from datetime import datetime, timedelta

# Configuration
sys.path.insert(0, '/home/delphinos/bureau/NJILA/njila-fleet-service')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fleet_config.settings')

import django
django.setup()

from django.db import transaction
from fleet.models import (
    Agence, Filiale, Bus, Chauffeur, Trajet, Voyage, Annonce, 
    StatusBus, StatusVoyage, StatutGlobalAgence
)
from fleet.rabbitmq import (
    publish_agence_created, publish_filiale_created, publish_staff_created,
    publish_annonce_published, publish_voyage_cancelled, publish_voyage_delayed,
    publish_voyage_departed, publish_agence_subscription_request
)

# Couleurs pour l'affichage
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
NC = '\033[0m'

def print_success(msg):
    print(f"{GREEN}✅ {msg}{NC}")

def print_error(msg):
    print(f"{RED}❌ {msg}{NC}")

def print_info(msg):
    print(f"{BLUE}📡 {msg}{NC}")

def print_warning(msg):
    print(f"{YELLOW}⚠️ {msg}{NC}")


def test_auth_service_communication():
    """Test de communication avec auth-service"""
    print("\n" + "="*60)
    print("🔐 TEST COMMUNICATION AVEC AUTH-SERVICE")
    print("="*60)
    
    # Simuler une requête de validation de token
    auth_service_url = "http://localhost:8081/api/auth/validate-token"
    
    try:
        response = requests.post(
            auth_service_url,
            headers={'X-Internal-Token': 'njila-shared-secret-2026'},
            json={'token': 'test-token'},
            timeout=2
        )
        
        if response.status_code in [200, 401]:
            print_success(f"Auth-service accessible (status: {response.status_code})")
            return True
        else:
            print_warning(f"Auth-service répond avec status {response.status_code}")
            return False
            
    except requests.exceptions.ConnectionError:
        print_error("Auth-service non accessible (port 8081)")
        return False
    except Exception as e:
        print_error(f"Erreur: {e}")
        return False


def test_rabbitmq_connection():
    """Test de connexion à RabbitMQ"""
    print("\n" + "="*60)
    print("🐇 TEST CONNEXION RABBITMQ")
    print("="*60)
    
    try:
        connection = pika.BlockingConnection(pika.ConnectionParameters('localhost', 5672))
        connection.close()
        print_success("Connexion à RabbitMQ réussie")
        return True
    except Exception as e:
        print_error(f"Connexion à RabbitMQ échouée: {e}")
        return False


def test_publish_events():
    """Test de publication des événements"""
    print("\n" + "="*60)
    print("📤 TEST PUBLICATION DES ÉVÉNEMENTS")
    print("="*60)
    
    # Créer une agence test
    agence = Agence.objects.create(
        name=f"Test Agence {uuid.uuid4().hex[:6]}",
        adresse="Douala",
        telephone="677777777",
        email_officiel=f"test_{uuid.uuid4().hex[:8]}@test.com"
    )
    print_info(f"Agence créée: {agence.name}")
    
    # Tester publication agence.created
    result1 = publish_agence_created(agence)
    print_success(f"agence.created: {'Publié' if result1 else 'Échec'}")
    
    # Tester publication subscription.request
    result2 = publish_agence_subscription_request(agence)
    print_success(f"subscription.request: {'Publié' if result2 else 'Échec'}")
    
    # Créer une filiale
    filiale = Filiale.objects.create(
        agence=agence,
        nom=f"Test Filiale {uuid.uuid4().hex[:4]}",
        code=f"TEST{uuid.uuid4().hex[:4]}",
        ville="Douala",
        adresse="Test Adresse",
        telephone="677777777",
        email=f"test_{uuid.uuid4().hex[:8]}@test.com"
    )
    
    # Tester publication filiale.created
    result3 = publish_filiale_created(filiale)
    print_success(f"filiale.created: {'Publié' if result3 else 'Échec'}")
    
    # Tester publication staff.created (chauffeur)
    chauffeur_id = uuid.uuid4()
    result4 = publish_staff_created(chauffeur_id, 'CHAUFFEUR', agence_id=agence.id_agence)
    print_success(f"staff.created (chauffeur): {'Publié' if result4 else 'Échec'}")
    
    # Créer un bus pour le voyage
    bus = Bus.objects.create(
        modele='Coaster',
        immatriculation=f"LT{uuid.uuid4().hex[:6]}",
        capacite=45,
        Id_agence=agence
    )
    
    # Créer un trajet
    trajet = Trajet.objects.create(
        filiale_depart=filiale,
        filiale_arrive=filiale,
        distance=100
    )
    
    # Créer un voyage
    voyage = Voyage.objects.create(
        date_heure_depart=datetime.now() + timedelta(days=1),
        date_heure_arrive_prevue=datetime.now() + timedelta(days=1, hours=4),
        prix=5000,
        places_disponibles=45,
        IdBus=bus,
        Id_trajet=trajet
    )
    
    # Tester publication voyage.cancelled
    result5 = publish_voyage_cancelled(voyage, "Test annulation")
    print_success(f"voyage.cancelled: {'Publié' if result5 else 'Échec'}")
    
    # Tester publication annonce
    annonce = Annonce.objects.create(
        type='retard',
        message='Test annonce',
        Id_voyage=voyage
    )
    result6 = publish_annonce_published(annonce)
    print_success(f"annonce.published: {'Publié' if result6 else 'Échec'}")
    
    # Nettoyer dans le bon ordre (du plus dépendant au moins dépendant)
    print_info("Nettoyage des données de test...")
    annonce.delete()
    voyage.delete()
    trajet.delete()
    bus.delete()
    filiale.delete()
    agence.delete()
    
    return all([result1, result2, result3, result4, result5, result6])


def test_consume_events():
    """Test de consommation des événements"""
    print("\n" + "="*60)
    print("📥 TEST CONSOMMATION DES ÉVÉNEMENTS")
    print("="*60)
    
    # Créer une agence test
    agence = Agence.objects.create(
        name=f"Test Consommation {uuid.uuid4().hex[:6]}",
        adresse="Douala",
        telephone="677777777",
        email_officiel=f"consume_{uuid.uuid4().hex[:8]}@test.com",
        statut_global='active'
    )
    print_info(f"Agence créée: {agence.name} (statut: {agence.statut_global})")
    
    # Publier un message d'expiration d'abonnement
    connection = pika.BlockingConnection(pika.ConnectionParameters('localhost'))
    channel = connection.channel()
    
    message = {
        'event_type': 'SUBSCRIPTION_EXPIRED',
        'agence_id': str(agence.id_agence),
        'agence_nom': agence.name,
        'expires_at': datetime.now().isoformat()
    }
    
    channel.basic_publish(
        exchange='njila.subscribe.exchange',
        routing_key='subscription.expired',
        body=json.dumps(message),
        properties=pika.BasicProperties(delivery_mode=2)
    )
    connection.close()
    
    print_info("Message d'expiration publié")
    
    # Attendre que le consommateur traite le message
    time.sleep(2)
    
    # Vérifier que l'agence a été mise à jour
    agence.refresh_from_db()
    
    if agence.statut_global == 'expiree':
        print_success("L'agence a été marquée comme expirée")
        result1 = True
    else:
        print_error(f"L'agence n'est pas expirée: {agence.statut_global}")
        result1 = False
    
    # Tester renouvellement
    message = {
        'event_type': 'SUBSCRIPTION_RENEWED',
        'agence_id': str(agence.id_agence),
        'agence_nom': agence.name,
        'new_expires_at': (datetime.now() + timedelta(days=365)).isoformat()
    }
    
    connection = pika.BlockingConnection(pika.ConnectionParameters('localhost'))
    channel = connection.channel()
    channel.basic_publish(
        exchange='njila.subscribe.exchange',
        routing_key='subscription.renewed',
        body=json.dumps(message),
        properties=pika.BasicProperties(delivery_mode=2)
    )
    connection.close()
    
    print_info("Message de renouvellement publié")
    time.sleep(2)
    
    agence.refresh_from_db()
    
    if agence.statut_global == 'active':
        print_success("L'agence a été réactivée")
        result2 = True
    else:
        print_error(f"L'agence n'est pas active: {agence.statut_global}")
        result2 = False
    
    # Nettoyer
    agence.delete()
    
    return result1 and result2


def test_exchanges_creation():
    """Vérifier que les exchanges sont créés"""
    print("\n" + "="*60)
    print("📦 TEST EXISTENCE DES EXCHANGES")
    print("="*60)
    
    expected_exchanges = [
        'njila.fleet.exchange',
        'njila.user.exchange',
        'njila.notification.exchange',
        'njila.subscribe.exchange',
        'njila.dead.letter.exchange'
    ]
    
    try:
        connection = pika.BlockingConnection(pika.ConnectionParameters('localhost'))
        channel = connection.channel()
        
        all_exchanges = []
        for exchange in expected_exchanges:
            try:
                channel.exchange_declare(
                    exchange=exchange,
                    exchange_type='topic',
                    passive=True
                )
                print_success(f"Exchange {exchange} existe")
                all_exchanges.append(True)
            except Exception:
                print_error(f"Exchange {exchange} n'existe pas")
                all_exchanges.append(False)
        
        connection.close()
        return all(all_exchanges)
        
    except Exception as e:
        print_error(f"Erreur: {e}")
        return False


def test_queues_creation():
    """Vérifier que les queues sont créées"""
    print("\n" + "="*60)
    print("📦 TEST EXISTENCE DES QUEUES")
    print("="*60)
    
    expected_queues = [
        'njila.fleet.subscription.queue',
        'njila.fleet.user.queue',
        'njila.fleet.booking.queue'
    ]
    
    try:
        connection = pika.BlockingConnection(pika.ConnectionParameters('localhost'))
        channel = connection.channel()
        
        all_queues = []
        for queue_name in expected_queues:
            try:
                result = channel.queue_declare(
                    queue=queue_name,
                    passive=True
                )
                print_success(f"Queue {queue_name} existe (messages: {result.method.message_count})")
                all_queues.append(True)
            except Exception:
                print_error(f"Queue {queue_name} n'existe pas")
                all_queues.append(False)
        
        connection.close()
        return all(all_queues)
        
    except Exception as e:
        print_error(f"Erreur: {e}")
        return False


def test_health_check():
    """Test l'endpoint health du service"""
    print("\n" + "="*60)
    print("🏥 TEST HEALTH CHECK")
    print("="*60)
    
    try:
        response = requests.get('http://localhost:8088/api/health/', timeout=2)
        if response.status_code == 200:
            print_success(f"Health check OK: {response.json()}")
            return True
        else:
            print_error(f"Health check échoué: {response.status_code}")
            return False
    except Exception as e:
        print_error(f"Health check: {e}")
        return False


def main():
    """Fonction principale"""
    print("\n" + "="*60)
    print("🚀 TEST D'INTÉGRATION FLEET-MANAGEMENT-SERVICE")
    print("="*60)
    print("Vérification des communications avec les autres services\n")
    
    results = {}
    
    # 1. Test auth-service
    results['auth_service'] = test_auth_service_communication()
    
    # 2. Test RabbitMQ
    results['rabbitmq_connection'] = test_rabbitmq_connection()
    if results['rabbitmq_connection']:
        results['exchanges'] = test_exchanges_creation()
        results['queues'] = test_queues_creation()
        results['publish'] = test_publish_events()
        results['consume'] = test_consume_events()
    else:
        results['exchanges'] = False
        results['queues'] = False
        results['publish'] = False
        results['consume'] = False
    
    # 3. Test health
    results['health'] = test_health_check()
    
    # Résumé
    print("\n" + "="*60)
    print("📊 RÉSUMÉ DES TESTS")
    print("="*60)
    
    total = len(results)
    passed = sum(1 for v in results.values() if v)
    
    for name, result in results.items():
        status = "✅" if result else "❌"
        print(f"  {status} {name}")
    
    print(f"\n{BLUE}Total: {passed}/{total} tests réussis{NC}")
    
    if passed == total:
        print(f"\n{GREEN}🎉 TOUS LES TESTS SONT RÉUSSIS !{NC}")
        print("Les communications avec les autres services fonctionnent correctement.")
    else:
        print(f"\n{YELLOW}⚠️ Certains tests ont échoué. Vérifiez les services suivants:{NC}")
        if not results.get('auth_service'):
            print("  - Auth-service (port 8081) n'est pas accessible")
        if not results.get('rabbitmq_connection'):
            print("  - RabbitMQ (port 5672) n'est pas accessible")
        if not results.get('exchanges'):
            print("  - Les exchanges RabbitMQ ne sont pas créés")
        if not results.get('queues'):
            print("  - Les queues RabbitMQ ne sont pas créées")
    
    return passed == total


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)