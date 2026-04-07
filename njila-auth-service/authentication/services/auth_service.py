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


@dataclass
class RegisterCommand:
    email:      str
    password:   str
    # Données d'identité — alignées avec UserProfile (user-service)
    name:       str                   # prénom  (UserProfile.name)
    surname:    str                   # nom     (UserProfile.surname)
    phone:      Optional[str] = None  # téléphone
    adresse:    Optional[str] = None  # adresse postale
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
        """
        1. Vérifier unicité email
        2. Créer NjilaUser avec toutes les données d'identité
        3. Publier → njila.user.exchange (profil complet) + njila.notification.exchange (bienvenue)
        4. Générer tokens + sauvegarder session
        """
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

        from django.conf import settings
        new_payload = TokenPayload(
            user_id    = payload.user_id,
            role       = payload.role,
            session_id = payload.session_id,
            filiale_id = payload.filiale_id,
            agence_id  = payload.agence_id,
        )
        access_ttl = settings.SIMPLE_JWT["ACCESS_TOKEN_LIFETIME"]
        return TokenPair(
            access_token  = self._jwt.generate(new_payload, ttl=access_ttl),
            refresh_token = refresh_token,
            expires_in    = int(access_ttl.total_seconds()),
        )

    # ─────────────────────────────────────────────────────────────────────────
    # VALIDATE TOKEN (interne)
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
    # GET ME
    # ─────────────────────────────────────────────────────────────────────────
    def get_me(self, user_id: str) -> Optional[NjilaUser]:
        return self._repo.find_user_by_id(user_id)

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