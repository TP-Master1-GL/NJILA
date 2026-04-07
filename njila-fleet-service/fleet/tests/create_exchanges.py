#!/usr/bin/env python
import pika

# Connexion
connection = pika.BlockingConnection(pika.ConnectionParameters('localhost'))
channel = connection.channel()

# Déclarer les exchanges
exchanges = [
    ('njila.fleet.exchange', 'topic'),
    ('njila.user.exchange', 'topic'),
    ('njila.notification.exchange', 'topic'),
    ('njila.subscribe.exchange', 'topic'),
    ('njila.dead.letter.exchange', 'direct'),
]

for exchange_name, exchange_type in exchanges:
    channel.exchange_declare(
        exchange=exchange_name,
        exchange_type=exchange_type,
        durable=True
    )
    print(f"✅ Exchange créé: {exchange_name} ({exchange_type})")

connection.close()
print("\n✅ Tous les exchanges ont été créés avec succès!")