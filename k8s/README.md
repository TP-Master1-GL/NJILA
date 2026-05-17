# 🚀 NJILA – Déploiement Kubernetes

Ce dossier contient l'ensemble des manifestes Kubernetes pour le projet NJILA, organisés avec **Kustomize**.

## 📁 Structure du dossier

```
k8s/
├── base/
│   ├── namespace.yaml              # Namespace "njila"
│   ├── kustomization.yaml          # Kustomization base
│   ├── configmaps/
│   │   └── configmaps.yaml         # app-config, messaging-config
│   ├── secrets/
│   │   └── secrets.yaml            # db-credentials, jwt-secret, rabbitmq-credentials
│   ├── statefulsets/
│   │   ├── postgres-dbs.yaml       # 7 bases PostgreSQL (auth, fleet, subscribe, user, booking, payement, notification)
│   │   ├── rabbitmq.yaml           # RabbitMQ + Service headless
│   │   └── redis.yaml              # Redis + Service headless
│   ├── deployments/
│   │   ├── core-services.yaml      # conf-service, registry-service (Eureka)
│   │   ├── microservices.yaml      # auth, fleet, subscribe, user, booking, payement, notification
│   │   └── gateway-frontend.yaml   # proxy-service (API Gateway), frontend (React)
│   └── ingress/
│       └── ingress.yaml            # Ingress NGINX
└── overlays/
    ├── dev/
    │   └── kustomization.yaml      # Overlay dev (1 réplica par service)
    └── prod/
        └── kustomization.yaml      # Overlay prod (2 réplicas par microservice)
```

## 🏗️ Architecture déployée

| Service | Type K8s | Port | Technologie |
|---|---|---|---|
| njila-conf-service | Deployment | 8080 | Spring Cloud Config |
| njila-registry-service | Deployment | 8761 | Eureka Server |
| njila-proxy-service | Deployment | 8888 | Spring Cloud Gateway |
| njila-auth-service | Deployment | 8081 | Django |
| njila-fleet-service | Deployment | 8088 | Django |
| njila-subscribe-service | Deployment | 8089 | Django |
| njila-user-service | Deployment | 8082 | Spring Boot |
| njila-booking-service | Deployment | 8083 | Spring Boot |
| njila-payement-service | Deployment | 8084 | Spring Boot |
| njila-notification-service | Deployment | 8085 | Node.js |
| njila-frontend | Deployment | 80 | React/Nginx |
| njila-auth-db | StatefulSet | 5432 | PostgreSQL 15 |
| njila-fleet-db | StatefulSet | 5432 | PostgreSQL 15 |
| njila-subscribe-db | StatefulSet | 5432 | PostgreSQL 15 |
| njila-user-db | StatefulSet | 5432 | PostgreSQL 15 |
| njila-booking-db | StatefulSet | 5432 | PostgreSQL 15 |
| njila-payement-db | StatefulSet | 5432 | PostgreSQL 15 |
| njila-notification-db | StatefulSet | 5432 | PostgreSQL 15 |
| njila-redis | StatefulSet | 6379 | Redis 7 |
| njila-rabbitmq | StatefulSet | 5672/15672 | RabbitMQ 3 |

## 🖼️ Images Docker requises

Avant de déployer, vous devez **builder et pusher** vos images Docker dans un registre accessible par votre cluster.

```bash
# Depuis la racine du projet NJILA
docker build -t njila/conf-service:latest ./njila-conf-service
docker build -t njila/registry-service:latest ./njila-registry-service
docker build -t njila/proxy-service:latest ./njila-proxy-service
docker build -t njila/auth-service:latest ./njila-auth-service
docker build -t njila/fleet-service:latest ./njila-fleet-service
docker build -t njila/subscribe-service:latest ./njila-subscribe-service
docker build -t njila/user-service:latest ./njila-user-service
docker build -t njila/booking-service:latest ./njila-booking-service
docker build -t njila/payement-service:latest ./njila-payement-service
docker build -t njila/notification-service:latest ./njila-notification-service
docker build -t njila/frontend:latest ./njila-frontend
```

> **💡 Pour Minikube :** Utilisez `eval $(minikube docker-env)` avant de builder pour charger les images directement dans le cluster sans push.

## 🚀 Déploiement

### Pré-requis
- `kubectl` installé et configuré (cluster Minikube, Kind, EKS, AKS, GKE...)
- `kustomize` installé (`kubectl kustomize` est intégré depuis kubectl v1.14)
- Ingress Controller NGINX installé sur le cluster

### 1. Installer l'Ingress Controller NGINX (si besoin)

```bash
# Pour Minikube
minikube addons enable ingress

# Pour un cluster générique
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.10.1/deploy/static/provider/cloud/deploy.yaml
```

### 2. Valider les manifestes (dry-run)

```bash
kubectl kustomize k8s/overlays/dev
```

### 3. Déployer en développement

```bash
kubectl apply -k k8s/overlays/dev
```

### 4. Vérifier le déploiement

```bash
# Voir tous les pods dans le namespace njila
kubectl get pods -n njila

# Voir tous les services
kubectl get services -n njila

# Voir les StatefulSets (bases de données)
kubectl get statefulsets -n njila

# Voir l'Ingress
kubectl get ingress -n njila

# Voir les logs d'un service (exemple auth)
kubectl logs -f deployment/njila-auth-service -n njila
```

### 5. Accéder à l'application (avec Minikube)

```bash
# Récupérer l'IP de Minikube
minikube ip

# Ajouter les entrées dans /etc/hosts
echo "$(minikube ip) njila.local api.njila.local eureka.njila.local rabbitmq.njila.local" | sudo tee -a /etc/hosts
```

Puis ouvrez dans votre navigateur :
- **Frontend :** http://njila.local
- **API Gateway :** http://api.njila.local
- **Eureka :** http://eureka.njila.local
- **RabbitMQ Management :** http://rabbitmq.njila.local

### 6. Déployer en production

```bash
kubectl apply -k k8s/overlays/prod
```

## 🗑️ Supprimer le déploiement

```bash
kubectl delete -k k8s/overlays/dev
# ou supprimer tout le namespace
kubectl delete namespace njila
```

## 🔐 Gestion des Secrets

> ⚠️ Les secrets actuels contiennent des credentials encodés en Base64 (non chiffrés). En production, utilisez :
> - **[Sealed Secrets](https://github.com/bitnami-labs/sealed-secrets)** (recommandé pour GitOps)
> - **HashiCorp Vault**
> - **AWS Secrets Manager** / **Azure Key Vault** / **GCP Secret Manager**

Pour re-générer un secret Base64 :
```bash
echo -n "votre_mot_de_passe" | base64
```

## 📈 Mise à l'échelle (HPA)

Pour activer l'autoscaling horizontal, installez le `metrics-server` puis :
```bash
kubectl autoscale deployment njila-auth-service -n njila --cpu-percent=70 --min=1 --max=5
kubectl autoscale deployment njila-booking-service -n njila --cpu-percent=70 --min=1 --max=5
```
