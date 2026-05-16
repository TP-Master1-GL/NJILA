FROM python:3.10-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=8081

WORKDIR /app

# Dépendances système
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    netcat-openbsd \
    python3-dev \
    libffi-dev \
    && rm -rf /var/lib/apt/lists/*

# Python deps
COPY requirements.txt .
RUN pip install --upgrade pip --no-cache-dir && \
    pip install --no-cache-dir -r requirements.txt

COPY . .
COPY start.sh /start.sh
RUN chmod +x /start.sh

# CRITIQUE: signal handling pour arrêt gracieux
STOPSIGNAL SIGTERM

CMD ["/start.sh"]