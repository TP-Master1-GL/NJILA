FROM python:3.10-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=8088

WORKDIR /app

# Dépendances système (PostgreSQL + build + netcat pour healthcheck)
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    netcat-openbsd \
    python3-dev \
    libffi-dev \
    && rm -rf /var/lib/apt/lists/*

# Installer dépendances Python
COPY requirements.txt .
RUN pip install --upgrade pip --no-cache-dir && \
    pip install --no-cache-dir -r requirements.txt

# Copier le code
COPY . .

# Copier et rendre exécutable le script de démarrage
COPY start.sh /start.sh
RUN chmod +x /start.sh

CMD ["/start.sh"]