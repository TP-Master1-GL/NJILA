"""
cloud.py — Pont entre njila-subscribe-service et l'infrastructure NJILA.

Responsabilités :
1. Récupérer la configuration depuis njila-conf-service (port 8080)
2. Enregistrer le service sur njila-registry-service / Eureka (port 8761)
"""

import os
import sys
import socket

import requests

# ─── Constantes ───────────────────────────────────────────────────────────────

APP_NAME          = "njila-subscribe-service"
CONFIG_SERVER_URL = os.environ.get("CONFIG_SERVER_URL", "http://localhost:8080")
EUREKA_URL        = os.environ.get("EUREKA_URL",        "http://localhost:8761/eureka/")
PROFILE           = os.environ.get("NJILA_PROFILE",     "default")


# ─── 1. Récupération de la configuration distante ─────────────────────────────

def fetch_remote_config() -> dict:
    """
    Interroge njila-conf-service et retourne un dict plat de propriétés.
    En cas d'échec (timeout, service absent), retourne un dict vide
    et laisse les valeurs locales (env vars / défauts) prendre le relais.
    """
    url = f"{CONFIG_SERVER_URL}/{APP_NAME}/{PROFILE}"
    sys.stderr.write(f"[CONFIG] Connexion à njila-conf-service : {url}\n")

    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()

        properties = {}
        for source in response.json().get("propertySources", []):
            properties.update(source.get("source", {}))

        sys.stderr.write(
            f"[CONFIG] OK — port reçu : {properties.get('server.port', 'non défini')}\n"
        )
        return properties

    except requests.exceptions.Timeout:
        sys.stderr.write("[CONFIG] WARN — Timeout — valeurs locales utilisées\n")
        return {}
    except requests.exceptions.ConnectionError:
        sys.stderr.write("[CONFIG] WARN — njila-conf-service inaccessible — valeurs locales utilisées\n")
        return {}
    except Exception as e:
        sys.stderr.write(f"[CONFIG] WARN — {e} — valeurs locales utilisées\n")
        return {}


# ─── 2. Enregistrement sur Eureka ─────────────────────────────────────────────

def register_to_eureka(port: int):
    """
    Enregistre njila-subscribe-service sur njila-registry-service (Eureka).
    En cas d'échec, le service démarre quand même (dégradé sans découverte).
    """
    import py_eureka_client.eureka_client as eureka_client

    try:
        host = socket.gethostbyname(socket.gethostname())
    except Exception:
        host = "127.0.0.1"

    sys.stderr.write(f"[EUREKA] Enregistrement : {APP_NAME} @ {host}:{port}\n")

    try:
        eureka_client.init(
            eureka_server            = EUREKA_URL,
            app_name                 = APP_NAME,
            instance_port            = port,
            instance_host            = host,
            renewal_interval_in_secs = 30,
            duration_in_secs         = 90,
            health_check_url         = f"http://{host}:{port}/actuator/health",
        )
        sys.stderr.write(f"[EUREKA] OK — {APP_NAME} enregistré\n")

    except Exception as e:
        sys.stderr.write(f"[EUREKA] WARN — Enregistrement échoué : {e}\n")