#!/usr/bin/env python
import os
import sys
import django
import json
import pika

sys.path.insert(0, '/home/delphinos/bureau/NJILA/njila-fleet-service')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fleet_config.settings')
django.setup()

from fleet.models import Agence

# Récupérer une agence
agence = Agence.objects.first()

if not agence:
    print("Aucune agence trouvée. Créez-en une d'abord.")
    sys.exit(1)

# Message d'expiration
message = {
    'event_type': 'SUBSCRIPTION_EXPIRED',
    'agence_id': str(agence.id_agence),
    'agence_nom': agence.name,
    'expires_at': '2026-12-31T23:59:59Z'
}

# Connexion à RabbitMQ
connection = pika.BlockingConnection(pika.ConnectionParameters('localhost'))
channel = connection.channel()

# Publier sur l'exchange subscribe
channel.basic_publish(
    exchange='njila.subscribe.exchange',
    routing_key='subscription.expired',
    body=json.dumps(message),
    properties=pika.BasicProperties(
        delivery_mode=2,
        content_type='application/json'
    )
)

print(f"✅ Message d'expiration envoyé pour l'agence: {agence.name}")
connection.close()