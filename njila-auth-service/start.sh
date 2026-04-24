#!/bin/sh
set -e

echo "================================================="
echo "  NJILA - njila-auth-service"
echo "================================================="
echo ""

# ── Etape 0 : attendre les dépendances ────────────────────────────────────────
echo "⏳ Attente des services..."

# PostgreSQL
while ! nc -z njila-auth-db 5432; do
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

PORT=$(python3 - <<EOF
import sys, os
sys.path.insert(0, "$(pwd)")
from auth_config.cloud import fetch_remote_config
cfg = fetch_remote_config()
print(int(cfg.get("server.port", 8081)))
EOF
)

echo "[START] Port resolu : $PORT"
echo ""

# ── Etape 2 : migrations base de données ──────────────────────────────────────
echo "[START] Etape 2 - Application des migrations..."

python manage.py migrate --noinput

echo "✅ Migrations OK"
echo ""

# ── Etape 3 : enregistrement Eureka ───────────────────────────────────────────
echo "[START] Etape 3 - Enregistrement sur Eureka..."

python3 - <<EOF
import sys, os
sys.path.insert(0, "$(pwd)")
from auth_config.cloud import register_to_eureka
register_to_eureka($PORT)
EOF

echo ""

# ── Etape 4 : démarrage du service ────────────────────────────────────────────
echo "[START] Etape 4 - Démarrage Gunicorn sur le port $PORT..."
echo ""

exec gunicorn auth_config.wsgi:application \
    --bind 0.0.0.0:$PORT \
    --workers 2 \
    --threads 2 \
    --timeout 120 \
    --access-logfile -