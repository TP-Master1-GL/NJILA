#!/usr/bin/env python3
"""
Service Eureka indépendant pour njila-fleet-service.
Lance dans un processus séparé pour que les heartbeats ne meurent jamais.
"""

import sys
import os
import time
import signal

# Ajouter le répertoire de l'app au path
sys.path.insert(0, os.getcwd())

from fleet_config.cloud import register_to_eureka, setup_graceful_shutdown

def main():
    """Lance Eureka et reste actif indéfiniment."""
    
    port = int(os.getenv("SERVICE_PORT", "8088"))
    
    sys.stderr.write(f"[EUREKA-PROCESS] Démarrage du service Eureka (PID: {os.getpid()})\n")
    
    # Configurer l'arrêt gracieux
    setup_graceful_shutdown()
    
    # S'enregistrer sur Eureka
    try:
        register_to_eureka(port)
    except Exception as e:
        sys.stderr.write(f"[EUREKA-PROCESS] ❌ Erreur : {e}\n")
        sys.exit(1)
    
    # Rester actif indéfiniment
    sys.stderr.write("[EUREKA-PROCESS] ✅ Eureka actif. Les heartbeats s'exécutent en arrière-plan.\n")
    sys.stderr.write("[EUREKA-PROCESS] ℹ️  Ce processus restera actif jusqu'à SIGTERM/SIGINT\n")
    
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        sys.stderr.write("\n[EUREKA-PROCESS] Arrêt gracieux\n")
        sys.exit(0)


if __name__ == "__main__":
    main()