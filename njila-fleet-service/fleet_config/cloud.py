"""
cloud.py — Pont entre njila-fleet-service et l'infrastructure NJILA.

Responsabilités :
1. Récupérer la configuration depuis njila-conf-service (port 8080)
2. Enregistrer le service sur njila-registry-service / Eureka (port 8761)
"""

import os
import sys
import requests
import signal
import atexit

# ─── Constantes ───────────────────────────────────────────────────────────────

APP_NAME          = "njila-fleet-service"
CONFIG_SERVER_URL = os.environ.get("CONFIG_SERVER_URL", "http://njila-conf-service:8080")
EUREKA_URL        = os.environ.get("EUREKA_URL",        "http://njila-registry-service:8761/eureka/")
PROFILE           = os.environ.get("NJILA_PROFILE",     "default")

# Variable globale pour garder une référence au client
_eureka_client = None
_eureka_running = False


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
    Enregistre njila-fleet-service sur njila-registry-service (Eureka).
    
    IMPORTANT: Les paramètres supportés par py_eureka_client sont:
    - eureka_server
    - app_name
    - instance_port
    - instance_host
    - renewal_interval_in_secs
    - duration_in_secs
    - health_check_url
    """
    global _eureka_client, _eureka_running

    import py_eureka_client.eureka_client as eureka_client

    try:
        # Utiliser le nom du service comme hostname pour Docker
        host = os.getenv("EUREKA_INSTANCE_HOSTNAME", "njila-fleet-service")
    except Exception:
        host = "njila-fleet-service"

    sys.stderr.write(f"[EUREKA] Enregistrement : {APP_NAME} @ {host}:{port}\n")
    
    try:
        # Initialiser le client Eureka
        # ⚠️ Paramètres supportés UNIQUEMENT:
        eureka_client.init(
            eureka_server            = EUREKA_URL,
            app_name                 = APP_NAME,
            instance_port            = port,
            instance_host            = host,
            renewal_interval_in_secs = 20,  # Réduit à 20s (de 30)
            duration_in_secs         = 60,  # Réduit à 60s (de 90)
            health_check_url         = f"http://{host}:{port}/health/",
        )
        
        _eureka_client = eureka_client
        _eureka_running = True
        
        sys.stderr.write("[EUREKA] ✅ Enregistrement réussi\n")
        sys.stderr.write("[EUREKA] ℹ️  Heartbeats envoyés automatiquement toutes les 20s\n")
        sys.stderr.write("[EUREKA] ℹ️  TTL avant expulsion: 60s\n")
        
    except Exception as e:
        sys.stderr.write(f"[EUREKA] ❌ Enregistrement échoué : {e}\n")
        import traceback
        traceback.print_exc()
        _eureka_running = False
        raise


def stop_eureka():
    """
    Désenregistrement propre lors de l'arrêt du service.
    Appelé automatiquement à l'extinction via atexit et les signaux.
    """
    global _eureka_client, _eureka_running
    
    if not _eureka_running:
        return
    
    try:
        if _eureka_client:
            sys.stderr.write("[EUREKA] ℹ️  Désenregistrement en cours...\n")
            _eureka_client.stop()
            _eureka_running = False
            sys.stderr.write("[EUREKA] ✅ Désenregistrement propre effectué\n")
    except Exception as e:
        sys.stderr.write(f"[EUREKA] ⚠️  Erreur lors du désenregistrement : {e}\n")


def setup_graceful_shutdown():
    """
    Configure l'arrêt gracieux du service Eureka.
    """
    # Arrêt via atexit (arrêt normal)
    atexit.register(stop_eureka)
    
    # Arrêt via signaux (Ctrl+C, SIGTERM depuis Docker)
    def signal_handler(signum, frame):
        sys.stderr.write(f"\n[EUREKA] Signal {signum} reçu - arrêt gracieux...\n")
        stop_eureka()
        sys.exit(0)
    
    signal.signal(signal.SIGTERM, signal_handler)
    signal.signal(signal.SIGINT, signal_handler)


# À appeler dans le main ou au démarrage de Gunicorn
if __name__ != "__main__":
    setup_graceful_shutdown()