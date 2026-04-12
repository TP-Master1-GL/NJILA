import json
import logging
import pika
from django.core.management.base import BaseCommand
from django.conf import settings
from agencies.models import AgenceMere

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = "Consomme les événements venant du njila-fleet-service (ex: SUBSCRIPTION_REQUEST)"

    def handle(self, *args, **options):
        # 1. Connexion
        credentials = pika.PlainCredentials(
            settings.RABBITMQ_USER,
            settings.RABBITMQ_PASSWORD,
        )
        params = pika.ConnectionParameters(
            host=settings.RABBITMQ_HOST,
            port=settings.RABBITMQ_PORT,
            credentials=credentials,
            heartbeat=60,
        )
        
        try:
            connection = pika.BlockingConnection(params)
            channel = connection.channel()

            # 2. Configuration Fleet
            # Exchange fleet (source)
            FLEET_EXCHANGE = "njila.fleet.exchange"
            channel.exchange_declare(exchange=FLEET_EXCHANGE, exchange_type="topic", durable=True)

            # Queue locale
            QUEUE_NAME = "subscribe.fleet.queue"
            channel.queue_declare(queue=QUEUE_NAME, durable=True)

            # Binding
            ROUTING_KEY = "fleet.subscription.request"
            channel.queue_bind(exchange=FLEET_EXCHANGE, queue=QUEUE_NAME, routing_key=ROUTING_KEY)

            self.stdout.write(self.style.SUCCESS(f"[*] Attente d'événements sur {QUEUE_NAME}..."))

            def callback(ch, method, properties, body):
                try:
                    payload = json.loads(body)
                    event_type = payload.get("event_type")

                    if event_type == "SUBSCRIPTION_REQUEST":
                        self.handle_subscription_request(payload)
                    else:
                        logger.warning(f"[MQ] Événement inconnu ignoré : {event_type}")

                    ch.basic_ack(delivery_tag=method.delivery_tag)
                except Exception as e:
                    logger.error(f"[MQ] Erreur traitement message : {e}")
                    # On ACK quand même pour éviter un poison pill, mais on log l'erreur
                    ch.basic_ack(delivery_tag=method.delivery_tag)

            channel.basic_consume(queue=QUEUE_NAME, on_message_callback=callback)
            channel.start_consuming()

        except KeyboardInterrupt:
            self.stdout.write(self.style.WARNING("\n[!] Interruption par l'utilisateur."))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Erreur fatale : {e}"))
            logger.exception("Erreur fatale dans le consommateur RabbitMQ")

    def handle_subscription_request(self, payload):
        agence_id = payload.get("agence_id")
        if not agence_id:
            logger.error("[MQ] SUBSCRIPTION_REQUEST reçu sans agence_id")
            return

        agency, created = AgenceMere.objects.update_or_create(
            agence_id=agence_id,
            defaults={
                "nom":            payload.get("agence_nom", ""),
                "email_officiel": payload.get("contact_email", ""),
                "telephone":      payload.get("contact_telephone", ""),
                "adresse":        payload.get("adresse", ""),
                "statut_global":  "EN_ATTENTE",
            }
        )

        action = "créée" if created else "mise à jour"
        self.stdout.write(self.style.SUCCESS(f"[MQ] Agence {agence_id} {action} avec succès ({agency.nom})."))
