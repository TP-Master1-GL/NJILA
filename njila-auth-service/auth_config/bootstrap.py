import requests
import logging
import sys

logger = logging.getLogger(__name__)

CONFIG_SERVER_URL = "http://localhost:8080"
APP_NAME          = "njila-auth-service"
PROFILE           = "default"


def fetch_remote_config() -> dict:
    """
    Appelle njila-conf-service (Spring Cloud Config) et retourne
    toutes les properties sous forme de dict plat.

    URL appelée : http://localhost:8080/njila-auth-service/default
    """
    url = f"{CONFIG_SERVER_URL}/{APP_NAME}/{PROFILE}"

    print(f"[CONFIG] Connexion à njila-conf-service - {url}")

    try:
        response = requests.get(url, timeout=5)
        response.raise_for_status()
        data = response.json()

        # Spring Cloud Config retourne :
        # { "propertySources": [ { "source": { "key": "value" } } ] }
        properties = {}
        for source in data.get("propertySources", []):
            properties.update(source.get("source", {}))

        print(f"[CONFIG] ✅ Configuration chargée depuis njila-conf-service")
        print(f"[CONFIG] Port reçu : {properties.get('server.port', 'non défini')}")
        return properties

    except requests.exceptions.ConnectionError:
        print(
            "[CONFIG] ⚠️  njila-conf-service indisponible sur "
            f"{CONFIG_SERVER_URL} — utilisation des valeurs locales (.env)"
        )
        return {}

    except requests.exceptions.Timeout:
        print("[CONFIG] ⚠️  Timeout — njila-conf-service ne répond pas")
        return {}

    except Exception as e:
        print(f"[CONFIG] ⚠️  Erreur inattendue : {e}")
        return {}
