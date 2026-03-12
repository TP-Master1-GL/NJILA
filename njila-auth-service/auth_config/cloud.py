import requests
import sys

# ─── Configuration ────────────────────────────────────────────────────────────
CONFIG_SERVER_URL = "http://localhost:8080"
EUREKA_URL        = "http://localhost:8761/eureka/"
APP_NAME          = "njila-auth-service"
PROFILE           = "default"


# ─── 1. Fetch config depuis njila-conf-service ────────────────────────────────
def fetch_remote_config() -> dict:
    url = f"{CONFIG_SERVER_URL}/{APP_NAME}/{PROFILE}"
    sys.stderr.write(f"[CONFIG] Connexion a njila-conf-service : {url}\n")
    try:
        response = requests.get(url, timeout=10)
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


# ─── 2. Enregistrement sur njila-registry-service (Eureka) ───────────────────
def register_to_eureka(port: int):
    import socket
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
            health_check_url         = f"http://{host}:{port}/api/auth/health",
        )
        sys.stderr.write("[EUREKA] OK - njila-auth-service enregistre\n")
    except Exception as e:
        sys.stderr.write(f"[EUREKA] WARN - Enregistrement echoue : {e}\n")
