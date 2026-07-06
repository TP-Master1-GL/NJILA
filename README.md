# NJILA — Plateforme Digitale Microservices de Gestion du Transport Interurbain

[![NJILA CI/CD Pipeline](https://github.com/TP-Master1-GL/NJILA/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/TP-Master1-GL/NJILA/actions/workflows/ci-cd.yml)
[![Kubernetes](https://img.shields.io/badge/Kubernetes-v1.28%2B-blue?logo=kubernetes)](https://kubernetes.io)
[![ArgoCD](https://img.shields.io/badge/GitOps-ArgoCD-orange?logo=argo)](https://argoproj.github.io/argo-cd/)
[![Django](https://img.shields.io/badge/Backend-Django%20%2F%20Spring%20Boot-green?logo=django&logoColor=white)](https://djangoproject.com)
[![React](https://img.shields.io/badge/Frontend-React%20%2F%20Vite%20%2F%20Tailwind-61dafb?logo=react)](https://react.dev)

> **NJILA**  est une plateforme d'entreprise hautement évolutive, sécurisée et modulaire sous forme de SaaS, conçue pour numériser l'écosystème du transport routier interurbain (notamment adapté au contexte camerounais). Elle permet la gestion complète des abonnements des agences de transport, le contrôle de leur flotte (bus, chauffeurs, trajets, voyages), la réservation de billets en temps réel avec verrouillage distribué, la gestion des paiements mobiles, et l'envoi de notifications multi-canaux (Push, Email, Firebase).

---

## 🗺️ Architecture Globale du Système

La plateforme repose sur une architecture de microservices découplés utilisant des technologies adaptées à chaque domaine d'activité (Spring Boot pour les workflows transactionnels lourds, Django REST pour la gestion rapide de modèles, Node.js pour l'événementiel asynchrone).



## 🛠️ Stack Technique

### 1. Services d'Infrastructure
*   **njila-conf-service** : Serveur de configuration centralisé (Spring Cloud Config) connecté à un dépôt Git sécurisé (`njila-cloud-conf`).
*   **njila-registry-service** : Serveur d'annuaire et de découverte de services (Netflix Eureka Server).
*   **njila-proxy-service** : API Gateway réactive (Spring Cloud Gateway) basée sur Spring WebFlux et Netty. Gère la sécurité des routes, le routage dynamique, la réécriture d'URL, la déduplication CORS, les Circuit Breakers, les retries, le Rate Limiting (Redis) et le Load Balancing personnalisé.

### 2. Microservices Métier
*   **njila-auth-service (Python / Django REST Framework)** : Module d'authentification centralisé, génération de tokens JWT (SimpleJWT) et sécurité RBAC (Role-Based Access Control).
*   **njila-user-service (Java 17 / Spring Boot 3.2)** : Service de gestion des fiches profils et des affectations du personnel d'agence (Administrateurs, Managers, Guichetiers, Voyageurs, Chauffeurs). Met en cache les requêtes de profils dans Redis.
*   **njila-fleet-service (Python / Django REST Framework)** : Service de gestion opérationnelle de la flotte : enregistrement des agences partenaires, filiales physiques, bus (capacité, immatriculation), affectation des chauffeurs, gestion des trajets (origines, destinations), programmation des voyages, avis des usagers et statistiques d'activité.
*   **njila-subscribe-service (Python / Django REST Framework)** : Gère le modèle de monétisation SaaS de la plateforme. Permet aux agences de s'abonner aux services de la plateforme via différents plans (essai, mensuels, trimestriels, annuels).
*   **njila-booking-service (Java 17 / Spring Boot 3.3)** : Moteur transactionnel de réservation de places de voyage. Utilise des verrous distribués Redis (`SETNX` avec TTL) pour garantir l'absence de surréservation (double attribution de sièges). Intègre le moteur iTextPDF pour générer des billets électroniques cryptés au format PDF.
*   **njila-payement-service (Java 17 / Spring Boot 3.3)** : Passerelle d'intégration des paiements mobiles (Mobile Money Orange / MTN).
*   **njila-notification-service (Node.js 20 / Express / Sequelize)** : Service asynchrone qui écoute les files d'attente RabbitMQ pour distribuer des alertes multi-canaux :
    *   Emails transactionnels via SMTP/Nodemailer.
    *   SMS via Twilio.
    *   Web Push Notifications.
    *   Mobile Push notifications via Firebase Cloud Messaging (FCM).

### 3. Frontend Web Client
*   **njila-frontend (React 19 / Vite 8 / Tailwind CSS 3)** : Application monopage (SPA) moderne et réactive avec gestion fine des rôles (Dashboards spécifiques pour l'Administrateur de plateforme, le Manager d'agence, le Guichetier en point de vente, et le Voyageur).
    *   **Zustand** : Gestion globale légère de l'état (authentification, thème sombre/clair).
    *   **TanStack React Query** : Synchronisation, mise en cache et requêtes HTTP optimisées vers l'API Gateway.
    *   **React Hook Form + Zod** : Validation stricte des formulaires côté client.
    *   **MSW (Mock Service Worker)** : Mocking d'API intégré pour le développement hors ligne.

---

## ⚡ Algorithme de Load-Balancing NJANGA v3.1

Le microservice `njila-proxy-service` intègre un algorithme de routage dynamique propriétaire appelé **NJANGA v3.1**. Contrairement au Round-Robin classique, NJANGA calcule en temps réel un score multicritère pondéré pour chaque instance de microservice disponible dans Eureka.

$$Score_{Total} = (Score_{Sant\acute{e}} \times 0.30) + (Score_{Charge} \times 0.25) + (Score_{Perf} \times 0.25) + (Score_{G\acute{e}o} \times 0.20) + Bonus_{Sp\acute{e}ciaux}$$

### Critères et coefficients de l'algorithme :
1.  **Santé Système (30% - CPU/RAM) :** Analyse l'utilisation CPU et mémoire renvoyée par la télémétrie de l'instance. Si l'un des seuils critiques est dépassé (CPU > 80%, RAM > 85%), l'instance subit une pénalité drastique de score.
2.  **Charge Active (25% - Connexions) :** Calcule le ratio de connexions actives par rapport à la capacité maximale déclarée de l'instance. Prédit les pics d'affluence en fonction de l'historique et de plages horaires clés (ex: les week-ends ou départs de nuit au Cameroun).
3.  **Performance Réelle (25% - Temps de réponse) :** Historique glissant des 100 derniers temps de réponse de l'instance stocké dans Redis. Les instances répondant en moins de 500ms obtiennent un score de 1.0, dégradé à 0.1 pour les temps supérieurs à 3000ms.
4.  **Géolocalisation (20% - Proximité) :** Associe l'IP du client à sa région et la compare à la région d'hébergement de l'instance (ex: Douala, Yaoundé, Garoua...). La correspondance exacte octroie un score de 1.0, et le voisinage régional direct (défini par une matrice géographique interne) donne 0.8.
5.  **Bonus Spéciaux :**
    *   *Sticky Session (+0.15)* : Si la session de l'utilisateur requiert de la cohérence d'état et que l'instance sélectionnée héberge déjà cette session (sous réserve que sa charge reste < 70%).
    *   *Route Cache (+0.10)* : Si l'instance possède déjà en mémoire locale cache les données du trajet demandé.

---

## 🔒 Résilience et Sécurité

*   **Sécurité Gateway (Zero-Trust interne) :** L'API Gateway filtre et valide le token JWT à l'entrée. Elle injecte ensuite des en-têtes sécurisées (`X-User-Id`, `X-User-Role`) vers les services internes. Les microservices vérifient de plus la signature du JWT via un secret partagé.
*   **Network Policies (Kubernetes) :** Les flux réseaux sont restreints à la maille pod. Les bases de données PostgreSQL n'acceptent de trafic que depuis leur microservice associé respectif. Seul l'IngressController peut adresser la Gateway.
*   **Circuit Breakers (Resilience4j) :** Toutes les routes de la Gateway sont protégées par des disjoncteurs. Si un microservice affiche un taux d'échec supérieur à 50% sur une fenêtre glissante de 10 requêtes, le circuit s'ouvre pour 30 secondes, redirigeant le trafic vers des endpoints de fallback statiques.
*   **Rate Limiter :** Limitation réactive du débit basée sur Redis pour empêcher les attaques par déni de service (DDoS) ou le scraping d'API.
*   **Verrou Distribué Anti-Doublon :** Pour éviter que deux guichetiers ne réservent le même siège sur un bus simultanément lors de transactions concurrentes rapides, le service de réservation acquiert un verrou Redis temporaire via `SETNX` sur la ressource `lock:voyage:{id}:siege:{num}` pendant 10 minutes (le temps de valider le paiement).

---

## 📦 Déploiement Local (Docker Compose)

Le fichier `docker-compose.yml` configure l'intégralité des 11 services de l'écosystème ainsi que les bases de données et brokers requis.

### Prérequis
*   Docker & Docker Compose v2+
*   JDK 17 + Maven (pour compiler les projets Java en local)
*   Python 3.11 + Virtualenv
*   Node.js 20+

### Démarrage rapide de l'écosystème
1.  **Lancer l'infrastructure de base (Bases de données, Cache, Broker) :**
    ```bash
    docker compose up -d njila-redis njila-rabbitmq njila-auth-db njila-fleet-db njila-subscribe-db njila-user-db njila-booking-db njila-payement-db njila-notification-db
    ```
2.  **Lancer les serveurs de configuration et d'enregistrement :**
    ```bash
    docker compose up -d njila-conf-service
    # Attendre que le port 8080 soit sain, puis lancer Eureka:
    docker compose up -d njila-registry-service
    ```
3.  **Lancer l'ensemble des microservices et le frontend :**
    ```bash
    docker compose up -d --build
    ```
4.  **Accéder aux interfaces :**
    *   **Frontend Web Client** : [http://localhost:5174](http://localhost:5174)
    *   **API Gateway** : [http://localhost:8888](http://localhost:8888)
    *   **Dashboard Eureka (Découverte)** : [http://localhost:8761](http://localhost:8761)
    *   **Console d'administration RabbitMQ** : [http://localhost:15672](http://localhost:15672)

---

## ☸️ Orchestration Kubernetes & GitOps (ArgoCD)

Le projet intègre une configuration de déploiement Kubernetes native hautement disponible, gérée par **Kustomize**.

### Structure des manifestes (`k8s/`)
```
k8s/
├── base/                         # Manifestes communs à tous les environnements
│   ├── namespace.yaml
│   ├── configmaps/
│   ├── secrets/
│   ├── statefulsets/             # Bases de données persistantes, Redis, RabbitMQ
│   ├── deployments/              # Core Services & Microservices
│   ├── services/
│   ├── ingress/                  # Fichier Ingress Nginx pour le routage externe
│   ├── network-policies/         # Règles de sécurité réseau inter-pod
│   └── hpa/                      # Autoscaling horizontal basé sur l'usage CPU/RAM
└── overlays/
    ├── dev/                      # Mode économie (Réplicas = 1)
    └── prod/                     # Haute disponibilité, PDB & Secrets réels
        ├── kustomization.yaml
        └── pdb.yaml              # PodDisruptionBudgets (MinAvailable=1 pod par service)
```

### GitOps avec ArgoCD
Le déploiement en production est entièrement automatisé à l'aide d'ArgoCD. L'application surveille l'état du dépôt Git et applique les modifications de manière déclarative.

Pour déployer l'application ArgoCD sur votre cluster :
```bash
kubectl apply -f k8s/argocd/application.yaml
```
La synchronisation applique automatiquement les politiques de `prune` (suppression des ressources orphelines) et de `selfHeal` (correction automatique des dérives manuelles sur le cluster).

---

## 🚀 Pipeline de CI/CD (GitHub Actions)

Le fichier `.github/workflows/ci-cd.yml` implémente un workflow d'intégration et de déploiement continus moderne et robuste à 8 étapes :



1.  **Tests Java** : Compilation et exécution de tests unitaires/intégration (`./mvnw clean verify`) sous JDK 17 pour les 6 services Spring Boot.
2.  **Tests Python** : Validation des microservices Django (`manage.py test`) sous Python 3.11.
3.  **Tests Node.js** : Exécution de la suite de tests du service de notification (`npm test`).
4.  **Compilation React** : Build de production de la SPA React/Vite.
5.  **Validation Kubernetes** : Validation de la syntaxe de compilation Kustomize pour les configurations `base`, `dev` et `prod`.
6.  **Build & Publication Docker** : Construction des images Docker multi-architectures et publication vers le GitHub Container Registry (GHCR) de l'organisation avec étiquetage basé sur le SHA court du commit git.
7.  **Mise à jour de la configuration Git** : Mise à jour automatique par un bot GitHub Actions du fichier `k8s/overlays/prod/kustomization.yaml` pour pointer vers les nouvelles versions d'images construites (SHA court).
8.  **Déploiement ArgoCD** : Appel de l'ArgoCD CLI pour forcer la synchronisation du cluster de production et suivi du statut du Rollout de manière synchrone.

---

## 📊 Script de Tests de Charge (Stress-Test)

Pour valider le comportement réactif de l'API Gateway, le bon fonctionnement des disjoncteurs Resilience4j, et l'efficacité de l'algorithme de load-balancing **NJANGA v3.1**, un outil de test de charge intensif est disponible à la racine du projet (`njila_load_test.sh`).

Ce script utilise **hey** (générateur HTTP écrit en Go) pour simuler une charge constante de **500 requêtes par seconde** par service avec injection dynamique de jetons de sécurité JWT.

### Utilisation du script de charge
1.  **Vérifier la présence de l'outil `hey` :**
    ```bash
    hey -h
    # Si non présent : sudo apt install hey
    ```
2.  **Exécuter le script :**
    ```bash
    chmod +x njila_load_test.sh
    ./njila_load_test.sh
    ```
3.  **Sélectionner le service cible :** Le script propose un menu interactif pour stresser soit un service spécifique (Auth, User, Fleet, Booking, Payment, Notification, Subscribe) soit la totalité de la plateforme en séquence.
4.  **Observer les résultats :**
    *   Taux de succès des requêtes (cible : > 99.9% de codes HTTP 2xx/3xx).
    *   Temps de latence P50, P95, et P99 (cible latence moyenne : < 200ms).
    *   Surveillance du déclenchement des Circuit Breakers :
        ```bash
        curl http://localhost:8888/actuator/circuitbreakerevents | jq .
        ```

---

## 👥 Contributeurs / Équipe du Projet

*   **NGUEMBU JOHN** — Lead Developer / Développeur Fullstack / Architecte
*   **MAAMOC RONEL** — Développeur Fullstack
*   **MAFFO LÆTITIA** — Développeuse Backend
*   **BETINE AUDREY** — Développeuse Backend
*   **TSABENG DELPAHN** — Développeur Backend

