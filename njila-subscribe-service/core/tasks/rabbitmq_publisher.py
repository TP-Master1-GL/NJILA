"""
core/tasks/rabbitmq_publisher.py
Publication d'événements vers njila-notification-service via RabbitMQ.

Exchange  : njila.subscribe.exchange  (topic, durable)
Routing keys :
subscribe.activated       → souscription ou renouvellement
subscribe.expiry.warning  → alerte J-30 / J-7 / J-1
subscribe.expired         → expiration J-0
subscribe.suspended       → suspension manuelle admin
"""

import json
import logging

import pika
from django.conf import settings

logger = logging.getLogger(__name__)


def _get_channel():
    """Ouvre une connexion RabbitMQ et déclare l'exchange NJILA."""
    credentials = pika.PlainCredentials(
        settings.RABBITMQ_USER,
        settings.RABBITMQ_PASSWORD,
    )
    params = pika.ConnectionParameters(
        host=settings.RABBITMQ_HOST,
        port=settings.RABBITMQ_PORT,
        credentials=credentials,
        heartbeat=60,
        blocked_connection_timeout=30,
    )
    conn    = pika.BlockingConnection(params)
    channel = conn.channel()

    # Exchange conforme à la convention NJILA : njila.subscribe.exchange
    channel.exchange_declare(
        exchange=settings.RABBITMQ_EXCHANGE,
        exchange_type="topic",
        durable=True,
    )
    return conn, channel


def _publish(routing_key: str, payload: dict):
    """Publie un message sur njila.subscribe.exchange."""
    try:
        conn, channel = _get_channel()
        channel.basic_publish(
            exchange=settings.RABBITMQ_EXCHANGE,
            routing_key=routing_key,
            body=json.dumps(payload),
            properties=pika.BasicProperties(
                content_type="application/json",
                delivery_mode=2,   # message persistant
            ),
        )
        conn.close()
        logger.info(f"[MQ] Publié → {settings.RABBITMQ_EXCHANGE} / {routing_key}")
    except Exception as e:
        logger.error(f"[MQ] Erreur publication {routing_key} : {e}")


# ─── Événements publics ───────────────────────────────────────────────────────

def publier_activated(agence_id: str, nom: str, email: str, plan: str, date_exp: str, cle_activation: str):
    """
    Nouvelle souscription ou renouvellement.
    Queue consommatrice : njila.subscribe.activated.queue → notification-service
    """
    _publish("subscribe.activated", {
        "agenceId":       agence_id,
        "agenceNom":      nom,
        "email":          email,
        "plan":           plan,
        "dateExpiration": date_exp,
        "cleActivation":  cle_activation,
    })


def publier_expiry_warning(agence_id: str, nom: str, email: str, plan: str, date_exp: str, jours_restants: int):
    """
    Alerte d'expiration imminente J-30, J-7, J-1.
    Queue consommatrice : njila.subscribe.expiry.warning.queue → notification-service
    """
    _publish("subscribe.expiry.warning", {
        "agenceId":       agence_id,
        "agenceNom":      nom,
        "email":          email,
        "plan":           plan,
        "dateExpiration": date_exp,
        "joursRestants":  jours_restants,
    })


def publier_expired(agence_id: str, nom: str, email: str,
                    plan: str, date_exp: str):
    """
    Expiration effective à J-0.
    Queue consommatrice : njila.subscribe.expired.queue → notification-service
    """
    _publish("subscribe.expired", {
        "agenceId":       agence_id,
        "agenceNom":      nom,
        "email":          email,
        "plan":           plan,
        "dateExpiration": date_exp,
    })


def publier_suspended(agence_id: str, nom: str, email: str,motif: str, admin_id: str):
    """
    Suspension manuelle par l'admin NJILA.
    Queue consommatrice : njila.subscribe.suspended.queue → notification-service
    """
    _publish("subscribe.suspended", {
        "agenceId":  agence_id,
        "agenceNom": nom,
        "email":     email,
        "motif":     motif,
        "adminId":   admin_id,
    })