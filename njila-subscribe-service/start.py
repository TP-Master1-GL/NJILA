#!/usr/bin/env python
"""
start.py — Point d'entrée unique du njila-subscribe-service.

Ordre de démarrage :
  1. Charge la configuration distante (njila-conf-service :8080)
  2. Configure Django
  3. S'enregistre sur Eureka (njila-registry-service :8761)
  4. Lance Gunicorn sur le port défini (défaut 8090)
"""
import os
import sys

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "njila_subscribe_service.settings")

import django
django.setup()

from django.conf import settings
from njila_subscribe_service.wsgi import register

# Enregistrement Eureka
register()

# Lancement Gunicorn
port    = settings.SERVER_PORT
workers = int(os.environ.get("GUNICORN_WORKERS", "2"))

sys.stderr.write(f"[START] Démarrage sur le port {port} ({workers} workers)\n")

os.execvp("gunicorn", [
    "gunicorn",
    "njila_subscribe_service.wsgi:application",
    "--bind",    f"0.0.0.0:{port}",
    "--workers", str(workers),
    "--timeout", "120",
    "--access-logfile", "-",
    "--error-logfile",  "-",
])