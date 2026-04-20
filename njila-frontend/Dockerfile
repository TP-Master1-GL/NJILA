# ─── Stage 1 : Build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copier les manifestes en premier pour profiter du cache Docker
COPY package.json package-lock.json ./

# Installer toutes les dépendances (y compris devDependencies nécessaires au build)
RUN npm install --legacy-peer-deps

# Copier le reste du projet
COPY . .

# Variables de build injectées via --build-arg dans docker-compose
ARG VITE_API_GATEWAY_URL=http://localhost:8888
ARG VITE_APP_NAME=NJILA
ARG VITE_BASE_URL=/

# Exposer comme variables d'environnement Vite au moment du build
ENV VITE_API_URL=${VITE_API_GATEWAY_URL}
ENV VITE_API_GATEWAY_URL=${VITE_API_GATEWAY_URL}
ENV VITE_APP_NAME=${VITE_APP_NAME}
ENV VITE_BASE_URL=${VITE_BASE_URL}

# Build de production
RUN npm run build

# ─── Stage 2 : Serve avec Nginx ───────────────────────────────────────────────
FROM nginx:1.27-alpine

# Supprimer la config Nginx par défaut
RUN rm /etc/nginx/conf.d/default.conf

# Config Nginx optimisée pour une SPA React Router
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copier les fichiers buildés depuis le stage précédent
COPY --from=builder /app/dist /usr/share/nginx/html

# Exposer le port 80
EXPOSE 80

# Nginx en foreground
CMD ["nginx", "-g", "daemon off;"]