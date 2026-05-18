import logging
import uuid
from dataclasses import dataclass
from typing import Optional

from django.contrib.auth.hashers import check_password
from django.utils import timezone

from authentication.events.publisher import EventPublisher
from authentication.models import (
    AuthSession,
    DeactivationReason,
    NjilaUser,
    Role,
)
from authentication.repositories.auth_repository import AuthRepository
from authentication.services.jwt_service import JwtTokenService, TokenPayload, TokenPair
from authentication.services.redis_cache import RedisSessionCache

logger = logging.getLogger(__name__)

# ─── Préfixe cache profil utilisateur ────────────────────────────────────────
USER_PROFILE_PREFIX = "njila:auth:profile:"   # njila:auth:profile:{userId}
USER_PROFILE_TTL    = 300                      # 5 minutes


@dataclass
class RegisterCommand:
    email:      str
    password:   str
    name:       str
    surname:    str
    phone:      Optional[str] = None
    adresse:    Optional[str] = None
    role:       str = Role.VOYAGEUR
    photo_url:  Optional[str] = None
    filiale_id: Optional[str] = None
    agence_id:  Optional[str] = None
    created_by: str = "SELF"


@dataclass
class LoginCommand:
    email:    str
    password: str


@dataclass
class RegisterResult:
    user_id:    str
    email:      str
    name:       str
    surname:    str
    role:       str
    photo_url:  Optional[str]
    token_pair: TokenPair


@dataclass
class LoginResult:
    user_id:    str
    email:      str
    name:       str
    surname:    str
    role:       str
    photo_url:  Optional[str]
    token_pair: TokenPair


# ─────────────────────────────────────────────────────────────────────────────
# Exceptions métier
# ─────────────────────────────────────────────────────────────────────────────
class EmailAlreadyExistsError(Exception):
    pass

class InvalidCredentialsError(Exception):
    pass

class AccountInactiveError(Exception):
    pass

class AccountLockedError(Exception):
    pass

class TokenInvalidError(Exception):
    pass

class SessionExpiredError(Exception):
    pass


# ─────────────────────────────────────────────────────────────────────────────
# AuthService
# ─────────────────────────────────────────────────────────────────────────────
class AuthService:

    def __init__(self):
        self._repo      = AuthRepository()
        self._jwt       = JwtTokenService()
        self._cache     = RedisSessionCache()
        self._publisher = EventPublisher()

    # ─────────────────────────────────────────────────────────────────────────
    # REGISTER
    # ─────────────────────────────────────────────────────────────────────────
    def register(self, cmd: RegisterCommand) -> RegisterResult:
        email = cmd.email.lower().strip()

        if self._repo.exists_by_email(email):
            raise EmailAlreadyExistsError(f"L'email '{email}' est déjà utilisé.")

        user = NjilaUser(
            email       = email,
            name        = cmd.name.strip()    if cmd.name    else "",
            surname     = cmd.surname.strip() if cmd.surname else "",
            phone       = cmd.phone,
            adresse     = cmd.adresse,
            role        = cmd.role,
            photo_url   = cmd.photo_url,
            filiale_id  = cmd.filiale_id,
            agence_id   = cmd.agence_id,
            is_active   = True,
            is_verified = False,
            created_by  = cmd.created_by,
        )
        user.set_password(cmd.password)
        self._repo.save_user(user)

        try:
            self._publisher.publish_user_registered(
                user_id    = str(user.id),
                email      = email,
                name       = user.name,
                surname    = user.surname,
                phone      = user.phone,
                adresse    = user.adresse,
                role       = cmd.role,
                photo_url  = cmd.photo_url,
                filiale_id = cmd.filiale_id,
                agence_id  = cmd.agence_id,
            )
        except Exception as e:
            logger.error("[AUTH] Événement register non envoyé : %s", e)

        session_id = str(uuid.uuid4())
        payload    = self._build_payload(user, session_id)
        token_pair = self._jwt.generate_pair(payload)
        self._save_session(user, session_id, token_pair)
        self._cache_user_profile(user)

        logger.info("[AUTH] Inscription réussie : %s [%s]", email, cmd.role)
        return RegisterResult(
            user_id    = str(user.id),
            email      = email,
            name       = user.name,
            surname    = user.surname,
            role       = cmd.role,
            photo_url  = cmd.photo_url,
            token_pair = token_pair,
        )

    # ─────────────────────────────────────────────────────────────────────────
    # LOGIN
    # ─────────────────────────────────────────────────────────────────────────
    def login(self, cmd: LoginCommand) -> LoginResult:
        email = cmd.email.lower().strip()

        user = self._repo.find_user_by_email(email)
        if user is None:
            raise InvalidCredentialsError("Email ou mot de passe incorrect.")

        if not user.is_active:
            raise AccountInactiveError(user.get_inactive_message())

        if user.is_locked():
            raise AccountLockedError("Compte temporairement verrouillé. Réessayez plus tard.")

        if not check_password(cmd.password, user.password):
            user.increment_failed_attempts()
            raise InvalidCredentialsError("Email ou mot de passe incorrect.")

        user.reset_failed_attempts()
        self._repo.update_last_login(user)

        session_id = str(uuid.uuid4())
        payload    = self._build_payload(user, session_id)
        token_pair = self._jwt.generate_pair(payload)
        self._save_session(user, session_id, token_pair)
        self._cache_user_profile(user)

        logger.info("[AUTH] Connexion réussie : %s [%s]", email, user.role)
        return LoginResult(
            user_id    = str(user.id),
            email      = email,
            name       = user.name,
            surname    = user.surname,
            role       = user.role,
            photo_url  = user.photo_url,
            token_pair = token_pair,
        )

    # ─────────────────────────────────────────────────────────────────────────
    # LOGOUT
    # ─────────────────────────────────────────────────────────────────────────
    def logout(self, access_token: str, logout_all: bool = False):
        payload = self._jwt.decode(access_token)
        if payload is None:
            raise TokenInvalidError("Token invalide ou expiré.")

        jti        = self._jwt.get_jti(access_token)
        session_id = payload.session_id
        user_id    = payload.user_id

        if jti and self._cache.is_blacklisted(jti):
            raise TokenInvalidError("Token déjà révoqué.")

        self._repo.invalidate_session(session_id)
        self._cache.delete_session(session_id, user_id)

        if jti:
            ttl = max((payload.exp - int(timezone.now().timestamp())), 1)
            self._cache.blacklist_token(jti, ttl)

        if logout_all:
            self._repo.invalidate_all(user_id)
            self._cache.delete_all_user_sessions(user_id)
            self._cache.delete_refresh_token(user_id)
            self._invalidate_user_profile_cache(user_id)

        logger.info("[AUTH] Déconnexion | user=%s all=%s", user_id, logout_all)

    # ─────────────────────────────────────────────────────────────────────────
    # REFRESH
    # ─────────────────────────────────────────────────────────────────────────
    def refresh(self, refresh_token: str) -> TokenPair:
        payload = self._jwt.decode(refresh_token)
        if payload is None:
            raise TokenInvalidError("Refresh token invalide ou expiré.")

        if not self._cache.session_exists(payload.session_id):
            raise SessionExpiredError("Session expirée. Veuillez vous reconnecter.")

        user = self._repo.find_user_by_id(payload.user_id)
        if user is None:
            raise TokenInvalidError("Utilisateur non trouvé")

        from django.conf import settings

        new_payload = TokenPayload(
            user_id    = str(user.id),
            role       = user.role,
            session_id = payload.session_id,
            filiale_id = str(user.filiale_id) if user.filiale_id else None,
            agence_id  = str(user.agence_id)  if user.agence_id  else None,
        )

        access_ttl       = settings.SIMPLE_JWT["ACCESS_TOKEN_LIFETIME"]
        new_access_token = self._jwt.generate(new_payload, ttl=access_ttl)

        self._update_session_cache(user, payload.session_id)
        self._cache_user_profile(user)

        logger.info("[AUTH] Refresh effectué pour user=%s", payload.user_id)

        return TokenPair(
            access_token  = new_access_token,
            refresh_token = refresh_token,
            expires_in    = int(access_ttl.total_seconds()),
        )

    # ─────────────────────────────────────────────────────────────────────────
    # GET ME — lecture depuis Redis, fallback DB
    # ─────────────────────────────────────────────────────────────────────────
    def get_me(self, user_id: str) -> Optional[NjilaUser]:
        """
        Retourne le profil utilisateur.
        1. Cherche dans le cache Redis (njila:auth:profile:{userId})
        2. Si absent ou si l'hydratation échoue → va en DB et met en cache
        """
        from django.core.cache import cache

        cache_key = f"{USER_PROFILE_PREFIX}{user_id}"

        # ── Tentative cache ───────────────────────────────────────────────────
        try:
            cached = cache.get(cache_key)
            if cached is not None:
                logger.debug("[AUTH] get_me CACHE HIT user=%s", user_id)
                hydrated = self._hydrate_user_from_cache(cached)
                if hydrated is not None:
                    return hydrated
                # Hydratation échouée → fallback DB
                logger.warning("[AUTH] get_me hydratation échouée → fallback DB user=%s", user_id)
        except Exception as e:
            logger.warning("[AUTH] get_me cache read error: %s", e)

        # ── Fallback DB ───────────────────────────────────────────────────────
        logger.debug("[AUTH] get_me CACHE MISS user=%s → DB", user_id)
        user = self._repo.find_user_by_id(user_id)
        if user is not None:
            self._cache_user_profile(user)
        return user

    # ─────────────────────────────────────────────────────────────────────────
    # VALIDATE TOKEN
    # ─────────────────────────────────────────────────────────────────────────
    def validate_token(self, token: str) -> Optional[TokenPayload]:
        jti = self._jwt.get_jti(token)
        if jti and self._cache.is_blacklisted(jti):
            return None
        return self._jwt.decode(token)

    # ─────────────────────────────────────────────────────────────────────────
    # RESET PASSWORD
    # ─────────────────────────────────────────────────────────────────────────
    def request_password_reset(self, email: str, base_url: str = "http://localhost:3000"):
        user = self._repo.find_user_by_email(email)
        if user is None:
            logger.info("[AUTH] Reset pour email inconnu : %s", email)
            return

        token      = self._repo.create_reset_token(user)
        reset_link = f"{base_url}/reset-password?token={token.token}"

        try:
            self._publisher.publish_password_reset(
                email      = email,
                reset_link = reset_link,
                name       = user.name,
            )
        except Exception as e:
            logger.error("[AUTH] Événement reset non envoyé : %s", e)

        logger.info("[AUTH] Reset password demandé pour %s", email)

    def confirm_password_reset(self, token_str: str, new_password: str):
        token = self._repo.find_reset_token(token_str)
        if token is None or not token.is_valid():
            raise TokenInvalidError("Token de réinitialisation invalide ou expiré.")

        user = token.user
        user.set_password(new_password)
        self._repo.save_user(user)
        self._repo.consume_reset_token(token)
        self._repo.invalidate_all(str(user.id))
        self._cache.delete_all_user_sessions(str(user.id))
        self._cache.delete_refresh_token(str(user.id))
        self._invalidate_user_profile_cache(str(user.id))
        logger.info("[AUTH] Mot de passe réinitialisé pour %s", user.email)

    # ─────────────────────────────────────────────────────────────────────────
    # GESTION STATUT (Admin)
    # ─────────────────────────────────────────────────────────────────────────
    def set_account_status(self, user_id: str, is_active: bool):
        user = self._repo.set_user_status(
            user_id   = user_id,
            is_active = is_active,
            reason    = DeactivationReason.ADMIN_SUSPENDED,
        )
        if user is None:
            raise ValueError(f"Utilisateur {user_id} introuvable.")

        if not is_active:
            self._repo.invalidate_all(user_id)
            self._cache.delete_all_user_sessions(user_id)
            self._invalidate_user_profile_cache(user_id)
            logger.info("[AUTH] Compte %s suspendu (admin)", user_id)
        else:
            logger.info("[AUTH] Compte %s réactivé (admin)", user_id)

    # ─────────────────────────────────────────────────────────────────────────
    # UPDATE PHOTO
    # ─────────────────────────────────────────────────────────────────────────
    def update_photo(self, user_id: str, photo_url: str) -> NjilaUser:
        user = self._repo.find_user_by_id(user_id)
        if user is None:
            raise ValueError(f"Utilisateur {user_id} introuvable.")

        user.photo_url = photo_url
        self._repo.save_user(user)
        self._cache_user_profile(user)

        try:
            self._publisher.publish_user_updated(
                user_id       = user_id,
                email         = user.email,
                email_changed = False,
                photo_url     = photo_url,
            )
        except Exception as e:
            logger.error("[AUTH] Événement photo non envoyé : %s", e)

        return user

    # ─────────────────────────────────────────────────────────────────────────
    # UPDATE PROFILE hooks
    # ─────────────────────────────────────────────────────────────────────────
    def invalidate_profile_cache(self, user_id: str):
        """À appeler depuis views.py après update_profile."""
        self._invalidate_user_profile_cache(user_id)

    def refresh_profile_cache(self, user: NjilaUser):
        """À appeler depuis views.py après update_profile."""
        self._cache_user_profile(user)

    # ─────────────────────────────────────────────────────────────────────────
    # FORCE REFRESH
    # ─────────────────────────────────────────────────────────────────────────
    def force_refresh(self, user_id: str) -> Optional[TokenPair]:
        user = self._repo.find_user_by_id(user_id)
        if user is None:
            logger.warning("[AUTH] force_refresh: utilisateur %s non trouvé", user_id)
            return None

        session = AuthSession.objects.filter(user_id=user_id, is_active=True).first()
        if not session:
            logger.warning("[AUTH] force_refresh: aucune session active pour user=%s", user_id)
            return None

        from django.conf import settings

        new_payload = TokenPayload(
            user_id    = str(user.id),
            role       = user.role,
            session_id = session.session_id,
            filiale_id = str(user.filiale_id) if user.filiale_id else None,
            agence_id  = str(user.agence_id)  if user.agence_id  else None,
        )

        access_ttl       = settings.SIMPLE_JWT["ACCESS_TOKEN_LIFETIME"]
        new_access_token = self._jwt.generate(new_payload, ttl=access_ttl)

        self._update_session_cache(user, session.session_id)
        self._cache_user_profile(user)

        logger.info("[AUTH] Force refresh effectué pour user=%s", user_id)

        return TokenPair(
            access_token  = new_access_token,
            refresh_token = session.refresh_token,
            expires_in    = int(access_ttl.total_seconds()),
        )

    # ─────────────────────────────────────────────────────────────────────────
    # Helpers privés
    # ─────────────────────────────────────────────────────────────────────────
    def _build_payload(self, user: NjilaUser, session_id: str) -> TokenPayload:
        return TokenPayload(
            user_id    = str(user.id),
            role       = user.role,
            session_id = session_id,
            filiale_id = str(user.filiale_id) if user.filiale_id else None,
            agence_id  = str(user.agence_id)  if user.agence_id  else None,
        )

    def _save_session(self, user: NjilaUser, session_id: str, token_pair: TokenPair):
        from django.conf import settings
        refresh_ttl = settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"]
        expires_at  = timezone.now() + refresh_ttl
        ttl_seconds = int(refresh_ttl.total_seconds())

        session = AuthSession(
            session_id    = session_id,
            user          = user,
            access_token  = token_pair.access_token,
            refresh_token = token_pair.refresh_token,
            expires_at    = expires_at,
            is_active     = True,
        )
        self._repo.save_session(session)

        self._cache.save_session(
            session_id  = session_id,
            user_id     = str(user.id),
            data        = {
                "userId":    str(user.id),
                "role":      user.role,
                "filialeId": str(user.filiale_id) if user.filiale_id else None,
                "photoUrl":  user.photo_url,
                "name":      user.name,
                "surname":   user.surname,
            },
            ttl_seconds = ttl_seconds,
        )

        refresh_jti = self._jwt.get_jti(token_pair.refresh_token)
        if refresh_jti:
            self._cache.save_refresh_token(
                user_id     = str(user.id),
                refresh_jti = refresh_jti,
                ttl_seconds = ttl_seconds,
            )

    def _update_session_cache(self, user: NjilaUser, session_id: str):
        try:
            cache_data = {
                "userId":    str(user.id),
                "role":      user.role,
                "filialeId": str(user.filiale_id) if user.filiale_id else None,
                "agenceId":  str(user.agence_id)  if user.agence_id  else None,
                "photoUrl":  user.photo_url,
                "name":      user.name,
                "surname":   user.surname,
                "email":     user.email,
                "phone":     user.phone,
                "adresse":   user.adresse,
            }
            cache_data = {k: v for k, v in cache_data.items() if v is not None}
            self._cache.save_session(
                session_id  = session_id,
                user_id     = str(user.id),
                data        = cache_data,
                ttl_seconds = 86400,
            )
        except Exception as e:
            logger.error("[AUTH] Erreur mise à jour cache session: %s", e)

    # ── Cache profil utilisateur ──────────────────────────────────────────────

    def _cache_user_profile(self, user: NjilaUser):
        """
        Stocke le profil complet en Redis.
        Clé : njila:auth:profile:{userId}   TTL : 5 min

        ✅ CORRECTION : ajout de is_verified, created_at, last_login_at
        pour que _hydrate_user_from_cache reconstitue un objet complet
        utilisable directement par UserMeSerializer sans accès DB.
        """
        from django.core.cache import cache
        import json

        profile = {
            "id":          str(user.id),
            "email":       user.email,
            "name":        user.name,
            "surname":     user.surname,
            "phone":       user.phone,
            "adresse":     user.adresse,
            "role":        user.role,
            "photo_url":   user.photo_url,
            "filiale_id":  str(user.filiale_id) if user.filiale_id else None,
            "agence_id":   str(user.agence_id)  if user.agence_id  else None,
            "is_active":   user.is_active,
            # ✅ AJOUT : champs manquants dans l'ancienne version
            "is_verified": getattr(user, "is_verified", False),
            "created_at":  (
                user.created_at.isoformat()
                if getattr(user, "created_at", None) else None
            ),
            "last_login_at": (
                user.last_login_at.isoformat()
                if getattr(user, "last_login_at", None) else None
            ),
        }
        try:
            cache.set(
                f"{USER_PROFILE_PREFIX}{user.id}",
                json.dumps(profile),
                timeout=USER_PROFILE_TTL,
            )
            logger.debug("[AUTH] Profil mis en cache user=%s TTL=%ds", user.id, USER_PROFILE_TTL)
        except Exception as e:
            logger.warning("[AUTH] Impossible de cacher le profil user=%s : %s", user.id, e)

    def _invalidate_user_profile_cache(self, user_id: str):
        """Supprime le cache profil (logout, suspension, reset password)."""
        from django.core.cache import cache
        try:
            cache.delete(f"{USER_PROFILE_PREFIX}{user_id}")
            logger.debug("[AUTH] Cache profil invalidé user=%s", user_id)
        except Exception as e:
            logger.warning("[AUTH] Erreur invalidation cache profil user=%s : %s", user_id, e)

    def _hydrate_user_from_cache(self, cached_json: str) -> Optional[NjilaUser]:
        """
        Reconstruit un objet NjilaUser léger depuis le JSON Redis.
        Évite complètement l'accès à la DB pour /me.

        ✅ CORRECTIONS :
        1. Initialise user._state (ModelState) pour éviter l'AttributeError
           quand Django tente un accès DB via un DeferredAttribute.
        2. Ajoute is_verified, created_at, last_login_at manquants.
        """
        import json
        from django.db.models.base import ModelState

        try:
            data = json.loads(cached_json)
            user = NjilaUser.__new__(NjilaUser)

            # ── CORRECTION CRITIQUE : initialiser _state ──────────────────────
            # Sans cet attribut, Django crash dès qu'un champ DeferredAttribute
            # (comme is_verified) tente de charger sa valeur depuis la DB.
            user._state       = ModelState()
            user._state.db    = "default"
            user._state.adding = False

            # ── Champs de base ────────────────────────────────────────────────
            user.id          = data.get("id")
            user.email       = data.get("email", "")
            user.name        = data.get("name", "")
            user.surname     = data.get("surname", "")
            user.phone       = data.get("phone")
            user.adresse     = data.get("adresse")
            user.role        = data.get("role", "")
            user.photo_url   = data.get("photo_url")
            user.filiale_id  = data.get("filiale_id")
            user.agence_id   = data.get("agence_id")
            user.is_active   = data.get("is_active", True)

            # ── AJOUT : champs manquants ──────────────────────────────────────
            user.is_verified   = data.get("is_verified", False)
            user.created_at    = self._parse_datetime(data.get("created_at"))
            user.last_login_at = self._parse_datetime(data.get("last_login_at"))

            return user

        except Exception as e:
            logger.warning("[AUTH] Erreur hydratation depuis cache : %s", e)
            return None

    def _parse_datetime(self, value: Optional[str]):
        """
        Parse une chaîne ISO 8601 en datetime aware, ou retourne None.
        Utilisé pour reconstituer created_at et last_login_at depuis le cache.
        """
        if not value:
            return None
        try:
            from django.utils.dateparse import parse_datetime
            return parse_datetime(value)
        except Exception:
            return None