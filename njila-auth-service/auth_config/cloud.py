import requests
import sys
import threading
import time
import os
import signal
import atexit

CONFIG_SERVER_URL = "http://njila-conf-service:8080"
EUREKA_URL        = "http://njila-registry-service:8761/eureka/"
APP_NAME          = "njila-auth-service"
PROFILE           = "default"

_eureka_client = None
_eureka_lock = threading.Lock()
_eureka_running = False


def fetch_remote_config() -> dict:
    url = f"{CONFIG_SERVER_URL}/{APP_NAME}/{PROFILE}"
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
    """
    Enregistre le service sur Eureka avec gestion robuste du cycle de vie.
    Les heartbeats s'exécutent automatiquement dans un daemon thread.
    
    IMPORTANT: py_eureka_client ne supporte que les paramètres suivants:
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
        host = os.getenv("EUREKA_INSTANCE_HOSTNAME", "njila-auth-service")
    except Exception:
        host = "njila-auth-service"

    sys.stderr.write(f"[EUREKA] Enregistrement : {APP_NAME} @ {host}:{port}\n")
    
    try:
        with _eureka_lock:
            # ⚠️ ATTENTION: Seuls ces paramètres sont supportés par py_eureka_client
            eureka_client.init(
                eureka_server            = EUREKA_URL,
                app_name                 = APP_NAME,
                instance_port            = port,
                instance_host            = host,
                # CRITIQUE: heartbeat interval - assez court pour réagir vite
                renewal_interval_in_secs = 20,  # Réduit de 30 à 20
                # CRITIQUE: TTL avant expulsion - doit être > 2 × renewal
                duration_in_secs         = 60,  # Réduit de 90 à 60
                # Health check: URL que Eureka peut vérifier
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
        raise  # Important pour que le startup échoue clairement


def stop_eureka():
    """
    Désenregistrement propre lors de l'arrêt du service.
    Appelé automatiquement à l'extinction via atexit et les signaux.
    """
    global _eureka_client, _eureka_running
    
    if not _eureka_running:
        return
    
    try:
        with _eureka_lock:
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