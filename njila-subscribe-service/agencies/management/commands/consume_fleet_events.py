import json
import logging
import pika
from django.core.management.base import BaseCommand
from django.conf import settings
from agencies.models import AgenceMere
from subscriptions.models import PlanChoices, StatutAbonnement
from subscriptions.service import SubscriptionService

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

            # 2. Configuration Subscription (Events from Fleet)
            # Exchange
            EXCHANGE = settings.RABBITMQ_EXCHANGE
            channel.exchange_declare(exchange=EXCHANGE, exchange_type="topic", durable=True)

            # Queue locale
            QUEUE_NAME = "subscribe.fleet.queue"
            channel.queue_declare(queue=QUEUE_NAME, durable=True)

            # Binding
            ROUTING_KEY = "subscription.request"
            channel.queue_bind(exchange=EXCHANGE, queue=QUEUE_NAME, routing_key=ROUTING_KEY)

            self.stdout.write(self.style.SUCCESS(f"[*] Attente d'événements sur {QUEUE_NAME} (Key: {ROUTING_KEY})..."))

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
        logger.info(f"[MQ] Agence {agence_id} {action} avec succès ({agency.nom}).")

        # Vérifier si l'agence a déjà un abonnement actif
        has_active = agency.abonnements.filter(
            statut__in=[StatutAbonnement.ACTIVE, StatutAbonnement.TRIAL, StatutAbonnement.EXPIRING]
        ).exists()

        if created or not has_active:
            logger.info(f"[MQ] Création d'un abonnement d'essai pour l'agence {agence_id}")
            try:
                SubscriptionService.souscrire(agency, PlanChoices.ESSAI)
                self.stdout.write(self.style.SUCCESS(f"[MQ] Abonnement d'ESSAI activé pour {agency.nom}."))
            except Exception as e:
                logger.error(f"[MQ] Erreur lors de la création de l'abonnement d'essai : {e}")
        else:
            self.stdout.write(self.style.WARNING(f"[MQ] L'agence {agency.nom} possède déjà un abonnement actif."))
