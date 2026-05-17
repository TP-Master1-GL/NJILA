#!/bin/bash
# ============================================================
# Script de build et push de toutes les images Docker
# Projet NJILA
# Usage:
#   ./build-images.sh                     → build local (IfNotPresent)
#   ./build-images.sh --push              → build + push vers le registre
#   REGISTRY=my-registry.io ./build-images.sh --push
# ============================================================

set -e

REGISTRY="${REGISTRY:-njila}"
TAG="${TAG:-latest}"
PUSH="${1:-}"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "🔨 Build des images Docker – Projet NJILA"
echo "   Registre : $REGISTRY"
echo "   Tag      : $TAG"
echo "   Dossier  : $ROOT_DIR"
echo ""

build_image() {
  local service="$1"
  local context="$2"
  local image="$REGISTRY/$service:$TAG"

  echo "📦 Building $image ..."
  docker build -t "$image" "$ROOT_DIR/$context"

  if [ "$PUSH" = "--push" ]; then
    echo "🚀 Pushing $image ..."
    docker push "$image"
  fi

  echo "✅ $image OK"
  echo ""
}

# ── Services Spring Boot ──────────────────────────────────
build_image "conf-service"      "njila-conf-service"
build_image "registry-service"  "njila-registry-service"
build_image "proxy-service"     "njila-proxy-service"
build_image "user-service"      "njila-user-service"
build_image "booking-service"   "njila-booking-service"
build_image "payement-service"  "njila-payement-service"

# ── Services Django (Python) ──────────────────────────────
build_image "auth-service"      "njila-auth-service"
build_image "fleet-service"     "njila-fleet-service"
build_image "subscribe-service" "njila-subscribe-service"

# ── Service Node.js ───────────────────────────────────────
build_image "notification-service" "njila-notification-service"

# ── Frontend React / Nginx ────────────────────────────────
build_image "frontend"          "njila-frontend"

echo "🎉 Toutes les images ont été buildées avec succès !"

if [ "$PUSH" != "--push" ]; then
  echo ""
  echo "💡 Pour Minikube (charger les images sans registre externe) :"
  echo "   eval \$(minikube docker-env) && ./k8s/build-images.sh"
  echo ""
  echo "💡 Pour pusher vers un registre :"
  echo "   REGISTRY=mon-registre.io TAG=v1.0.0 ./k8s/build-images.sh --push"
fi
