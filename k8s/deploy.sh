#!/bin/bash
# ============================================================
# Script de déploiement rapide – Projet NJILA sur Kubernetes
# Usage: ./k8s/deploy.sh [dev|prod] [--dry-run]
# ============================================================

set -e

ENV="${1:-dev}"
DRY_RUN="${2:-}"
NAMESPACE="njila"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[NJILA K8s]${NC} $1"; }
success() { echo -e "${GREEN}✅ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }
error() { echo -e "${RED}❌ $1${NC}"; exit 1; }

# ── Vérification des pré-requis ───────────────────────────
check_prereqs() {
  log "Vérification des pré-requis..."

  command -v kubectl >/dev/null 2>&1 || error "kubectl non trouvé. Installez kubectl."
  command -v docker  >/dev/null 2>&1 || error "docker non trouvé. Installez Docker."

  kubectl cluster-info >/dev/null 2>&1 || error "Aucun cluster Kubernetes accessible. Vérifiez votre kubeconfig."

  success "Pré-requis OK"
}

# ── Build des images Docker ───────────────────────────────
build_images() {
  log "Build des images Docker..."

  # Pour Minikube, charger les images directement
  if kubectl get nodes | grep -q "minikube"; then
    warn "Cluster Minikube détecté — chargement des images dans le cluster..."
    eval $(minikube docker-env)
  fi

  bash "$ROOT_DIR/k8s/build-images.sh"
  success "Images Docker buildées"
}

# ── Déploiement ───────────────────────────────────────────
deploy() {
  local overlay="k8s/overlays/$ENV"
  log "Déploiement en environnement : $ENV"
  log "Overlay : $overlay"

  if [ "$DRY_RUN" = "--dry-run" ]; then
    warn "MODE DRY-RUN : Aperçu des ressources qui seraient créées"
    kubectl kustomize "$ROOT_DIR/$overlay"
    return
  fi

  # Appliquer les manifestes
  kubectl apply -k "$ROOT_DIR/$overlay"
  success "Manifestes appliqués"
}

# ── Attendre que les pods soient prêts ────────────────────
wait_for_pods() {
  log "Attente que les pods soient prêts (timeout 10 min)..."

  # Attendre les StatefulSets (bases de données)
  kubectl rollout status statefulset/njila-redis         -n $NAMESPACE --timeout=300s || warn "Redis pas encore prêt"
  kubectl rollout status statefulset/njila-rabbitmq      -n $NAMESPACE --timeout=300s || warn "RabbitMQ pas encore prêt"

  # Attendre les services core
  kubectl rollout status deployment/njila-conf-service     -n $NAMESPACE --timeout=300s
  kubectl rollout status deployment/njila-registry-service -n $NAMESPACE --timeout=300s

  # Attendre les microservices
  for svc in auth fleet subscribe user booking payement notification; do
    kubectl rollout status deployment/njila-${svc}-service -n $NAMESPACE --timeout=300s || warn "$svc-service pas encore prêt"
  done

  kubectl rollout status deployment/njila-proxy-service -n $NAMESPACE --timeout=300s
  kubectl rollout status deployment/njila-frontend      -n $NAMESPACE --timeout=300s

  success "Tous les pods sont prêts !"
}

# ── Afficher le résumé ────────────────────────────────────
print_summary() {
  echo ""
  echo "════════════════════════════════════════════════"
  echo " 🚀 NJILA déployé sur Kubernetes !"
  echo "════════════════════════════════════════════════"
  kubectl get pods      -n $NAMESPACE
  echo ""
  kubectl get services  -n $NAMESPACE
  echo ""
  kubectl get ingress   -n $NAMESPACE
  echo ""

  # Info Minikube
  if kubectl get nodes | grep -q "minikube"; then
    MINIKUBE_IP=$(minikube ip 2>/dev/null || echo "N/A")
    echo "════════════════════════════════════════════════"
    echo " 🌐 Accès (Minikube IP: $MINIKUBE_IP)"
    echo "   Ajoutez dans /etc/hosts :"
    echo "   $MINIKUBE_IP  njila.local api.njila.local eureka.njila.local rabbitmq.njila.local"
    echo ""
    echo "   Frontend :          http://njila.local"
    echo "   API Gateway :       http://api.njila.local"
    echo "   Eureka Dashboard :  http://eureka.njila.local"
    echo "   RabbitMQ Mgmt :     http://rabbitmq.njila.local"
    echo "════════════════════════════════════════════════"
  fi
}

# ── Entrypoint principal ──────────────────────────────────
main() {
  echo ""
  echo "████████████████████████████████████████"
  echo "   NJILA – Déploiement Kubernetes"
  echo "   Environnement : $ENV"
  echo "████████████████████████████████████████"
  echo ""

  [ "$ENV" != "dev" ] && [ "$ENV" != "prod" ] && error "Environnement invalide. Utilisez 'dev' ou 'prod'."

  check_prereqs
  build_images
  deploy

  if [ "$DRY_RUN" != "--dry-run" ]; then
    wait_for_pods
    print_summary
  fi
}

main
