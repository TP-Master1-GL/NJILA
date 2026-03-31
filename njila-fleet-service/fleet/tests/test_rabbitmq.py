#!/usr/bin/env python
import pika

def test_connection():
    try:
        connection = pika.BlockingConnection(
            pika.ConnectionParameters(host='localhost', port=5672)
        )
        print("✅ Connexion réussie à RabbitMQ!")
        connection.close()
        return True
    except Exception as e:
        print(f"❌ Erreur de connexion: {e}")
        return False

if __name__ == "__main__":
    test_connection()