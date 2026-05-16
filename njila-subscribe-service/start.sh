#!/bin/bash
set -e

echo "================================================="
echo "  NJILA - njila-subscribe-service"
echo "================================================="
echo ""

# ── Étape 0 : attendre les dépendances ────────────────────────────────────────
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

# ── Étape 1 : récupérer la config distante ────────────────────────────────────
echo "[START] Étape 1 - Lecture config depuis njila-conf-service..."

PORT=$(python3 -c "
import sys, os
sys.path.insert(0, '$(pwd)')
from cloud import fetch_remote_config
cfg = fetch_remote_config()
print(int(cfg.get('server.port', 8090)))
")

echo "[START] Port résolu : $PORT"
echo ""

# ── Étape 2 : migrations base de données ──────────────────────────────────────
echo "[START] Étape 2 - Application des migrations..."

python manage.py migrate --noinput

echo "✅ Migrations OK"
echo ""

# ── Étape 3 : collecte des fichiers statiques ─────────────────────────────────
echo "[START] Étape 3 - Collecte des fichiers statiques..."

python manage.py collectstatic --noinput 2>/dev/null || echo "⚠️ collectstatic ignoré"

echo "✅ Static files collected"
echo ""

# ── Étape 4 : LANCER EUREKA DANS UN PROCESSUS SÉPARÉ ──────────────────────────
echo "[START] Étape 4 - Lancement du service Eureka (processus séparé)..."

# Lancer start_eureka.py en arrière-plan
python3 start_eureka.py &
EUREKA_PID=$!

echo "✅ Service Eureka lancé (PID: $EUREKA_PID)"
echo ""

# ── Étape 5 : démarrage du service avec Gunicorn ──────────────────────────────
echo "[START] Étape 5 - Démarrage Gunicorn sur le port $PORT..."
echo ""

# Fonction pour arrêter gracieusement
cleanup() {
    echo ""
    echo "[MAIN] Signal reçu - arrêt gracieux..."
    
    # Arrêter Eureka
    if kill -0 $EUREKA_PID 2>/dev/null; then
        echo "[MAIN] Arrêt du service Eureka (PID: $EUREKA_PID)..."
        kill $EUREKA_PID
        wait $EUREKA_PID 2>/dev/null || true
    fi
    
    # Gunicorn s'arrêtera automatiquement
    exit 0
}

# Configurer les signaux
trap cleanup SIGTERM SIGINT

# Lancer Gunicorn (foreground, pas de exec)
gunicorn njila_subscribe_service.wsgi:application \
    --bind 0.0.0.0:$PORT \
    --workers 2 \
    --threads 2 \
    --timeout 120 \
    --access-logfile - \
    --error-logfile - \
    --log-level info

# Attendre que Eureka se termine
wait $EUREKA_PID