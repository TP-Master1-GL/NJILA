#!/bin/bash

DOCKERHUB_USER="nguembu"
VERSION="v1"

SERVICES=(
  "njila-njila-auth-service"
  "njila-njila-booking-service"
  "njila-njila-conf-service"
  "njila-njila-fleet-service"
  "njila-njila-frontend"
  "njila-njila-notification-service"
  "njila-njila-payement-service"
  "njila-njila-proxy-service"
  "njila-njila-registry-service"
  "njila-njila-subscribe-service"
  "njila-njila-user-service"
)

for service in "${SERVICES[@]}"; do
  # On simplifie le nom du repo Docker Hub en enlevant le préfixe "njila-"
  repo_name="${service#njila-}"
  
  echo "Tagging $service -> $DOCKERHUB_USER/$repo_name:$VERSION"
  docker tag $service:latest $DOCKERHUB_USER/$repo_name:$VERSION

  echo "Pushing $DOCKERHUB_USER/$repo_name:$VERSION"
  docker push $DOCKERHUB_USER/$repo_name:$VERSION
done

echo "Terminé ! Vérifie sur https://hub.docker.com/repositories/$DOCKERHUB_USER"
