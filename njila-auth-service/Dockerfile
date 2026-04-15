# Dockerfile corrigé - terra-auth-service
FROM python:3.10-alpine

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=8081

WORKDIR /app

RUN apk update && \
    apk add --no-cache \
        mariadb-connector-c-dev \
        build-base \
        pkgconfig \
        && rm -rf /var/cache/apk/*

COPY requirements.txt .

RUN pip install --upgrade pip --no-cache-dir && \
    pip install --no-cache-dir -r requirements.txt

# Copier le code
COPY . .

# Nettoyer les packages de compilation
RUN apk del build-base pkgconfig && \
    rm -rf /var/cache/apk/*

# NE PAS faire les migrations ici - elles seront faites au démarrage
CMD ["sh", "-c", "python manage.py makemigrations --noinput && python manage.py migrate --noinput && python manage.py runserver 0.0.0.0:${PORT:-8081}"]