#!/bin/bash
set -e

echo "================================================="
echo "  NJILA - njila-auth-service"
echo "================================================="
echo ""

source venv/bin/activate

# ── Etape 1 : port depuis njila-conf-service ──────────────────────────────────
echo "[START] Etape 1 - Lecture config sur njila-conf-service (8080)..."

PORT=$(python3 -c "
import sys, os
sys.path.insert(0, '$(pwd)')
from auth_config.cloud import fetch_remote_config
cfg = fetch_remote_config()
print(int(cfg.get('server.port', 8081)))
")

echo "[START] Port resolu : $PORT"
echo ""

# ── Etape 2 : enregistrement Eureka ───────────────────────────────────────────
echo "[START] Etape 2 - Enregistrement sur njila-registry-service (8761)..."

python3 -c "
import sys, os
sys.path.insert(0, '$(pwd)')
from auth_config.cloud import register_to_eureka
register_to_eureka($PORT)
"
echo ""

# ── Etape 3 : demarrage Django ────────────────────────────────────────────────
echo "[START] Etape 3 - Demarrage Django sur le port $PORT..."
echo ""
python manage.py runserver 0.0.0.0:$PORT

