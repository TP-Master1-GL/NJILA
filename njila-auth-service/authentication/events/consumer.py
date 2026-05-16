import json
import logging
import threading
import time
from typing import Optional

from authentication.repositories.auth_repository import AuthRepository
from authentication.services.redis_cache import RedisSessionCache

logger = logging.getLogger(__name__)

# ── Exchanges ─────────────────────────────────────────────────────────────────
EXCHANGE_USER        = "njila.user.exchange"
EXCHANGE_SUBSCRIBE   = "njila.subscribe.exchange"
EXCHANGE_DEAD_LETTER = "njila.dead.letter.exchange"

# ── Queues consommées par l'auth-service ──────────────────────────────────────
QUEUE_USER_REGISTERED      = "njila.user.registered.queue"
QUEUE_USER_UPDATED         = "njila.user.updated.queue"
QUEUE_STAFF_TO_AUTH        = "njila.auth.staff-creation.queue"
QUEUE_SUBSCRIPTION_EXPIRED = "njila.auth.subscription.expired.queue"
QUEUE_SUBSCRIPTION_RENEWED = "njila.auth.subscription.renewed.queue"

MAX_RETRIES = 5

DEAD_LETTER_ARGS = {
    "x-dead-letter-exchange":    EXCHANGE_DEAD_LETTER,
    "x-dead-letter-routing-key": "dead.letter",
    "x-message-ttl":             86400000,
}

# Sentinel pour distinguer "champ absent du payload" de "champ présent mais vide"
_MISSING = object()


def uuid_to_str(value) -> Optional[str]:
    """Convertit un UUID en string de manière sûre."""
    if value is None:
        return None
    if isinstance(value, str):
        return value if value else None
    try:
        return str(value)
    except Exception:
        return None


class EventConsumer:
    """Consommateur RabbitMQ en thread daemon avec reconnexion automatique."""

    def __init__(self):
        self._thread     = None
        self._should_run = True
        self._connection = None
        self._channel    = None

    def start(self):
        self._thread = threading.Thread(
            target=self._run,
            daemon=True,
            name="njila-auth-rabbitmq-consumer",
        )
        self._thread.start()
        logger.info("[CONSUMER] Thread RabbitMQ démarré")

    def stop(self):
        self._should_run = False
        if self._connection and self._connection.is_open:
            self._connection.close()

    def _run(self):
        while self._should_run:
            try:
                import pika
                from django.conf import settings

                logger.info("[CONSUMER] Tentative de connexion à RabbitMQ...")

                params = pika.ConnectionParameters(
                    host=getattr(settings, "RABBITMQ_HOST", "localhost"),
                    port=int(getattr(settings, "RABBITMQ_PORT", 5672)),
                    virtual_host=getattr(settings, "RABBITMQ_VHOST", "/"),
                    credentials=pika.PlainCredentials(
                        username=getattr(settings, "RABBITMQ_USER", "guest"),
                        password=getattr(settings, "RABBITMQ_PASS", "guest"),
                    ),
                    heartbeat=30,
                    blocked_connection_timeout=30,
                    connection_attempts=3,
                    retry_delay=2,
                )

                self._connection = pika.BlockingConnection(params)
                self._channel    = self._connection.channel()

                for exchange, ex_type in [
                    (EXCHANGE_USER,        "topic"),
                    (EXCHANGE_SUBSCRIBE,   "topic"),
                    (EXCHANGE_DEAD_LETTER, "direct"),
                ]:
                    self._channel.exchange_declare(
                        exchange=exchange,
                        exchange_type=ex_type,
                        durable=True,
                    )

                queues = [
                    (QUEUE_USER_REGISTERED,      EXCHANGE_USER,      "user.registered",     DEAD_LETTER_ARGS),
                    (QUEUE_USER_UPDATED,         EXCHANGE_USER,      "user.updated",        DEAD_LETTER_ARGS),
                    (QUEUE_STAFF_TO_AUTH,        EXCHANGE_USER,      "staff.to.auth",       DEAD_LETTER_ARGS),
                    (QUEUE_SUBSCRIPTION_EXPIRED, EXCHANGE_SUBSCRIBE, "subscribe.expired",   DEAD_LETTER_ARGS),
                    (QUEUE_SUBSCRIPTION_RENEWED, EXCHANGE_SUBSCRIBE, "subscribe.activated", DEAD_LETTER_ARGS),
                ]

                for queue_name, exchange, routing_key, args in queues:
                    try:
                        self._channel.queue_declare(
                            queue=queue_name,
                            durable=True,
                            arguments=args,
                        )
                        self._channel.queue_bind(
                            queue=queue_name,
                            exchange=exchange,
                            routing_key=routing_key,
                        )
                        self._channel.basic_consume(
                            queue=queue_name,
                            on_message_callback=self._dispatch,
                            auto_ack=False,
                        )
                        logger.info(
                            "[CONSUMER] ✅ Écoute  queue=%-48s  exchange=%-28s  key=%s",
                            queue_name, exchange, routing_key,
                        )
                    except Exception as queue_err:
                        logger.error(
                            "[CONSUMER] ❌ Échec déclaration queue=%s : %s",
                            queue_name, queue_err,
                        )

                self._channel.basic_qos(prefetch_count=1)
                logger.info("[CONSUMER] ✅ Connecté à RabbitMQ, démarrage consommation...")
                self._channel.start_consuming()

            except Exception as e:
                logger.error("[CONSUMER] Connexion perdue: %s", e)
                if self._should_run:
                    logger.info("[CONSUMER] Reconnexion dans 5 secondes...")
                    time.sleep(5)

    def _dispatch(self, ch, method, properties, body):
        routing_key = method.routing_key
        retry_count = 0
        if properties.headers:
            deaths = properties.headers.get("x-death", [])
            if deaths:
                retry_count = deaths[0].get("count", 0)

        try:
            data = json.loads(body)
            logger.debug("[CONSUMER] Message reçu | key=%-30s retry=%d", routing_key, retry_count)

            if routing_key == "user.registered":
                self._handle_user_registered(data)
            elif routing_key == "user.updated":
                self._handle_user_updated(data)
            elif routing_key == "staff.to.auth":
                self._handle_staff_to_auth(data)
            elif routing_key == "subscribe.expired":
                self._handle_subscription_expired(data)
            elif routing_key == "subscribe.activated":
                self._handle_subscription_renewed(data)
            else:
                logger.warning("[CONSUMER] Routing key inconnue : %s", routing_key)

            ch.basic_ack(delivery_tag=method.delivery_tag)

        except Exception as e:
            logger.error("[CONSUMER] Erreur | key=%s error=%s", routing_key, e)
            requeue = retry_count < MAX_RETRIES
            ch.basic_nack(delivery_tag=method.delivery_tag, requeue=requeue)
            if not requeue:
                logger.error("[CONSUMER] Dead letter | key=%s", routing_key)

    # ── Handlers user / staff ─────────────────────────────────────────────────

    def _handle_user_registered(self, data: dict):
        role = data.get("role", "VOYAGEUR")
        if role == "VOYAGEUR":
            self._create_auth_account(data)
        else:
            logger.debug("[CONSUMER] user.registered ignoré pour rôle=%s", role)

    def _handle_user_updated(self, data: dict):
        """
        Met à jour les données de l'utilisateur en BDD (profil ET photo).

        Règles de mise à jour :
        - Un champ absent du payload (clé inexistante) → ignoré, on ne touche pas à la BDD.
        - Un champ présent mais vide string ("") → on l'écrit tel quel (l'utilisateur
          a effacé la valeur côté user-service, on répercute).
        - Un champ présent avec une valeur identique à la BDD → ignoré (pas de save inutile).

        Champs gérés : name, surname, phone, adresse, photo_url, email (si emailChanged=True).
        """
        user_id = data.get("userId")
        if not user_id:
            logger.error("[CONSUMER] user.updated : userId manquant")
            return

        repo = AuthRepository()
        user = repo.find_user_by_id(user_id)
        if user is None:
            logger.warning("[CONSUMER] user.updated : utilisateur %s non trouvé", user_id)
            return

        updated = False
        updated_fields = []

        # ── Champs texte simples ──────────────────────────────────────────────
        # On utilise _MISSING pour distinguer "absent" de "présent mais vide".
        text_fields = [
            ("name",      "name"),
            ("surname",   "surname"),
            ("phone",     "phone"),
            ("adresse",   "adresse"),
            ("photo_url", "photo_url"),  # ← photo de profil
        ]

        for payload_key, model_attr in text_fields:
            value = data.get(payload_key, _MISSING)

            # Clé absente du payload → on ne touche pas ce champ
            if value is _MISSING:
                continue

            # Normaliser None → "" pour comparaison homogène
            current = getattr(user, model_attr) or ""
            incoming = value if value is not None else ""

            if incoming != current:
                setattr(user, model_attr, incoming if incoming != "" else None)
                updated = True
                updated_fields.append(payload_key)

        # ── Email (uniquement si emailChanged=True) ───────────────────────────
        email_changed = data.get("emailChanged", False)
        new_email     = data.get("email", _MISSING)

        if email_changed and new_email is not _MISSING and new_email:
            new_email_clean = new_email.lower().strip()
            if new_email_clean != (user.email or ""):
                if repo.exists_by_email(new_email_clean):
                    logger.warning(
                        "[CONSUMER] user.updated: nouvel email déjà utilisé %s", new_email_clean
                    )
                else:
                    user.email = new_email_clean
                    updated = True
                    updated_fields.append("email")

        # ── Persistance ───────────────────────────────────────────────────────
        if updated:
            repo.save_user(user)
            logger.info(
                "[CONSUMER] Profil mis à jour en BDD | userId=%s | champs=%s",
                user_id, updated_fields,
            )
        else:
            logger.debug(
                "[CONSUMER] user.updated : aucune modification détectée | userId=%s", user_id
            )

    def _handle_staff_to_auth(self, data: dict):
        logger.info(
            "[CONSUMER] staff.to.auth reçu | userId=%s email=%s role=%s",
            data.get("userId"), data.get("email"), data.get("role"),
        )
        self._create_auth_account(data)

    def _handle_subscription_expired(self, data: dict):
        agence_id = data.get("agenceId")
        if not agence_id:
            logger.error("[CONSUMER] subscribe.expired : agenceId manquant")
            return

        agence_nom = data.get("agenceNom", "?")
        repo  = AuthRepository()
        cache = RedisSessionCache()

        user_ids = repo.deactivate_agence_users(agence_id)

        if not user_ids:
            logger.info(
                "[CONSUMER] subscribe.expired | agence=%s (%s) — aucun user actif",
                agence_id, agence_nom,
            )
            return

        repo.invalidate_sessions_by_user_ids(user_ids)

        for user_id in user_ids:
            cache.delete_all_user_sessions(user_id)
            cache.delete_refresh_token(user_id)

        logger.info(
            "[CONSUMER] subscribe.expired | agence=%s (%s) | %d users désactivés",
            agence_id, agence_nom, len(user_ids),
        )

    def _handle_subscription_renewed(self, data: dict):
        agence_id = data.get("agenceId")
        if not agence_id:
            logger.error("[CONSUMER] subscribe.activated : agenceId manquant")
            return

        agence_nom = data.get("agenceNom", "?")
        repo     = AuthRepository()
        user_ids = repo.reactivate_agence_users(agence_id)

        if not user_ids:
            logger.info(
                "[CONSUMER] subscribe.activated | agence=%s (%s) — aucun user à réactiver",
                agence_id, agence_nom,
            )
            return

        logger.info(
            "[CONSUMER] subscribe.activated | agence=%s (%s) | %d users réactivés",
            agence_id, agence_nom, len(user_ids),
        )

    def _create_auth_account(self, data: dict):
        from authentication.models import NjilaUser
        from django.core.validators import validate_email
        from django.core.exceptions import ValidationError
        import uuid

        repo      = AuthRepository()
        email     = data.get("email", "").lower().strip()
        role      = data.get("role", "GUICHETIER")
        user_id   = data.get("userId")
        password  = data.get("passwordTemp", "0000")

        name      = data.get("name", "")
        surname   = data.get("surname", "")
        phone     = data.get("phone")
        adresse   = data.get("adresse")
        photo_url = data.get("photo_url") or data.get("photoUrl")

        filiale_id = data.get("filialeId")
        agence_id  = data.get("agenceId")

        if filiale_id in ("", "null", None):
            filiale_id = None
        elif filiale_id:
            try:
                uuid.UUID(filiale_id)
            except ValueError:
                logger.warning("[CONSUMER] filialeId invalide: %s", filiale_id)
                filiale_id = None

        if agence_id in ("", "null", None):
            agence_id = None
        elif agence_id:
            try:
                uuid.UUID(agence_id)
            except ValueError:
                logger.warning("[CONSUMER] agenceId invalide: %s", agence_id)
                agence_id = None

        if not email:
            logger.error("[CONSUMER] Création compte impossible : email manquant")
            return

        try:
            validate_email(email)
        except ValidationError:
            logger.error("[CONSUMER] Email invalide : %s", email)
            return

        if repo.exists_by_email(email):
            logger.warning("[CONSUMER] Compte déjà existant pour %s — ignoré", email)
            return

        final_user_id = user_id or str(uuid.uuid4())

        meta_data     = {}
        poste         = data.get("poste")
        numero_permis = data.get("numeroPermis")
        if poste:
            meta_data["poste"] = poste
        if numero_permis:
            meta_data["numeroPermis"] = numero_permis

        user = NjilaUser(
            id          = final_user_id,
            email       = email,
            name        = name,
            surname     = surname,
            phone       = phone,
            adresse     = adresse,
            role        = role.upper(),
            photo_url   = photo_url,
            filiale_id  = filiale_id,
            agence_id   = agence_id,
            is_active   = True,
            is_verified = True,
            created_by  = "SYSTEM",
            meta_data   = meta_data if meta_data else None,
        )
        user.set_password(password)
        repo.save_user(user)

        logger.info(
            "[CONSUMER] ✅ Compte auth créé | userId=%s email=%s role=%s",
            final_user_id, email, role,
        )