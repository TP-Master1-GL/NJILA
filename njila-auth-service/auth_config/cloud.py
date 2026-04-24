import requests
import sys
import threading
import time
import socket

CONFIG_SERVER_URL = "http://njila-conf-service:8080"
EUREKA_URL        = "http://njila-registry-service:8761/eureka/"
APP_NAME          = "njila-auth-service"
PROFILE           = "default"

# Variable globale pour garder une référence au client
_eureka_client = None


def fetch_remote_config() -> dict:
    url = f"{APP_NAME}/{PROFILE}"
    sys.stderr.write(f"[CONFIG] Connexion a njila-conf-service : {url}\n")
    try:
        response = requests.get(url, timeout=50)
        response.raise_for_status()
        properties = {}
        for source in response.json().get("propertySources", []):
            properties.update(source.get("source", {}))
        sys.stderr.write(f"[CONFIG] OK - Port recu : {properties.get('server.port', 'non defini')}\n")
        return properties
    except requests.exceptions.Timeout:
        sys.stderr.write("[CONFIG] WARN - Timeout - utilisation valeurs locales\n")
        return {}
    except Exception as e:
        sys.stderr.write(f"[CONFIG] WARN - {e} - utilisation valeurs locales\n")
        return {}


def register_to_eureka(port: int):
    global _eureka_client
    import py_eureka_client.eureka_client as eureka_client

    try:
        host = os.getenv("EUREKA_INSTANCE_HOSTNAME", "njila-auth-service")
    except Exception:
        host = "njila-auth-service"

    sys.stderr.write(f"[EUREKA] Enregistrement : {APP_NAME} @ {host}:{port}\n")
    
    try:
        # Initialiser le client Eureka
        eureka_client.init(
            eureka_server            = EUREKA_URL,
            app_name                 = APP_NAME,
            instance_port            = port,
            instance_host            = host,
            renewal_interval_in_secs = 30,
            duration_in_secs         = 90,
            health_check_url         = f"http://{host}:{port}/api/auth/health",
        )
        
        _eureka_client = eureka_client
        
        sys.stderr.write("[EUREKA] OK - njila-auth-service enregistre\n")
        sys.stderr.write("[EUREKA] Les heartbeats sont envoyés automatiquement toutes les 30s\n")
        
    except Exception as e:
        sys.stderr.write(f"[EUREKA] WARN - Enregistrement echoue : {e}\n")


def stop_eureka():
    """Appeler cette fonction à l'arrêt du service pour désenregistrement propre"""
    global _eureka_client
    if _eureka_client:
        try:
            _eureka_client.stop()
            sys.stderr.write("[EUREKA] Désenregistrement propre effectué\n")
        except Exception as e:
            sys.stderr.write(f"[EUREKA] Erreur lors du désenregistrement : {e}\n")