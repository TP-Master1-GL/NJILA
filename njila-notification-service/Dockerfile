# Dockerfile pour njila-notification-service
FROM node:20-alpine

# Installer curl et wget pour les health checks
RUN apk add --no-cache curl wget

WORKDIR /app

# 1. Copier package.json et package-lock.json
COPY package*.json ./

# 2. Installer les dépendances (plus permissif que npm ci)
RUN npm install --omit=dev --legacy-peer-deps

# 3. Copier le reste du code
COPY . .

# 4. Variables d'environnement par défaut
ENV NODE_ENV=production \
    PORT=8085 \
    HOSTNAME=njila-notification-service \
    SERVICE_NAME=njila-notification-service \
    CONFIG_SERVICE_URL=http://njila-conf-service:8080 \
    EUREKA_HOST=njila-registry-service \
    EUREKA_PORT=8761

# 5. Créer un utilisateur non-root (mais garder root pour les logs)
# USER nodejs

EXPOSE 8085

# 6. Commande de démarrage avec logs non-buffered pour Docker
CMD ["node", "--trace-warnings", "src/index.js"]