#!/bin/bash
set -e

echo "================================================="
echo "  NJILA - njila-subscribe-service"
echo "================================================="
echo ""

# ── Etape 0 : attendre les dépendances ────────────────────────────────────────
echo "⏳ Attente des services..."

# PostgreSQL
while ! nc -z njila-subscribe-db 5432; do
  echo "⏳ Waiting for PostgreSQL..."
  sleep 2
done

# Config Server
while ! nc -z njila-conf-service 8080; do
  echo "⏳ Waiting for Config Server..."
  sleep 2
done

# Eureka
while ! nc -z njila-registry-service 8761; do
  echo "⏳ Waiting for Eureka..."
  sleep 2
done

echo "✅ Tous les services sont disponibles"
echo ""

# ── Etape 1 : récupérer la config distante ────────────────────────────────────
echo "[START] Etape 1 - Lecture config depuis njila-conf-service..."

# IMPORTANT: cloud.py est à la racine, donc import direct sans préfixe
PORT=$(python3 -c "
import sys, os
sys.path.insert(0, '$(pwd)')
from cloud import fetch_remote_config
cfg = fetch_remote_config()
print(int(cfg.get('server.port', 8090)))
")

echo "[START] Port resolu : $PORT"
echo ""

# ── Etape 2 : migrations base de données ──────────────────────────────────────
echo "[START] Etape 2 - Application des migrations..."

python manage.py migrate --noinput

echo "✅ Migrations OK"
echo ""

# ── Etape 3 : collecte des fichiers statiques (optionnel) ─────────────────────
echo "[START] Etape 3 - Collecte des fichiers statiques..."

python manage.py collectstatic --noinput 2>/dev/null || echo "⚠️ collectstatic ignoré (pas de fichiers statiques)"

echo "✅ Static files collected (ou ignoré)"
echo ""

# ── Etape 4 : enregistrement Eureka ───────────────────────────────────────────
echo "[START] Etape 4 - Enregistrement sur Eureka..."

python3 -c "
import sys, os
sys.path.insert(0, '$(pwd)')
from cloud import register_to_eureka
register_to_eureka($PORT)
"

echo "✅ Enregistrement Eureka effectué"
echo ""

# ── Etape 5 : démarrage du service avec Gunicorn ──────────────────────────────
echo "[START] Etape 5 - Démarrage Gunicorn sur le port $PORT..."
echo ""

exec gunicorn njila_subscribe_service.wsgi:application \
    --bind 0.0.0.0:$PORT \
    --workers 2 \
    --threads 2 \
    --timeout 120 \
    --access-logfile -