
import uuid
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone as dt_timezone
from typing import Optional

import jwt
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# DTOs
# ─────────────────────────────────────────────────────────────────────────────
@dataclass
class TokenPayload:
    
    user_id:    str
    role:       str
    session_id: str
    filiale_id: Optional[str] = None
    agence_id:  Optional[str] = None
    iat:        int = field(default_factory=lambda: int(datetime.now(dt_timezone.utc).timestamp()))
    exp:        int = 0

    def is_expired(self) -> bool:
        return self.exp < int(datetime.now(dt_timezone.utc).timestamp())

    def get_role(self) -> str:
        return self.role


@dataclass
class TokenPair:
    """Paire de tokens retournée lors de la connexion / inscription."""
    access_token:  str
    refresh_token: str
    expires_in:    int          
    token_type:    str = "Bearer"


# ─────────────────────────────────────────────────────────────────────────────
# JwtTokenService
# ─────────────────────────────────────────────────────────────────────────────
class JwtTokenService:

    ALGORITHM = "HS256"

    def __init__(self):
        self._secret         = settings.SECRET_KEY
        self._access_ttl     = settings.SIMPLE_JWT["ACCESS_TOKEN_LIFETIME"]
        self._refresh_ttl    = settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"]

    # ── Génération d'un token unique ─────────────────────────────────────────
    def generate(self, payload: TokenPayload, ttl=None) -> str:
        
        if ttl is None:
            ttl = self._access_ttl

        now = datetime.now(dt_timezone.utc)
        data = {
            "sub":        str(payload.user_id),
            "role":       payload.role,
            "session_id": str(payload.session_id),
            "filiale_id": str(payload.filiale_id) if payload.filiale_id else None,
            "agence_id":  str(payload.agence_id)  if payload.agence_id  else None,
            "iat":        int(now.timestamp()),
            "exp":        int((now + ttl).timestamp()),
            "jti":        str(uuid.uuid4()),
        }
        return jwt.encode(data, self._secret, algorithm=self.ALGORITHM)

    # ── Validation ────────────────────────────────────────────────────────────
    def validate(self, token: str) -> bool:
        """Retourne True si le token est valide (signature + non expiré)."""
        try:
            jwt.decode(token, self._secret, algorithms=[self.ALGORITHM])
            return True
        except jwt.ExpiredSignatureError:
            logger.debug("JWT expiré")
            return False
        except jwt.InvalidTokenError as e:
            logger.debug("JWT invalide : %s", e)
            return False

    # ── Décodage ──────────────────────────────────────────────────────────────
    def decode(self, token: str) -> Optional[TokenPayload]:
        
        try:
            data = jwt.decode(
                token, self._secret,
                algorithms=[self.ALGORITHM],
                options={"verify_exp": True},
            )
            return TokenPayload(
                user_id    = data["sub"],
                role       = data["role"],
                session_id = data.get("session_id", ""),
                filiale_id = data.get("filiale_id"),
                agence_id  = data.get("agence_id"),
                iat        = data.get("iat", 0),
                exp        = data.get("exp", 0),
            )
        except jwt.ExpiredSignatureError:
            logger.debug("Décodage refusé : token expiré")
            return None
        except jwt.InvalidTokenError as e:
            logger.debug("Décodage refusé : %s", e)
            return None

    def decode_unverified(self, token: str) -> Optional[dict]:
        
        try:
            return jwt.decode(
                token, options={"verify_signature": False, "verify_exp": False},
                algorithms=[self.ALGORITHM],
            )
        except Exception:
            return None

    # ── Paire access + refresh ────────────────────────────────────────────────
    def generate_pair(self, payload: TokenPayload) -> TokenPair:
     
        access_token  = self.generate(payload, ttl=self._access_ttl)
        refresh_token = self.generate(payload, ttl=self._refresh_ttl)
        expires_in    = int(self._access_ttl.total_seconds())
        return TokenPair(
            access_token  = access_token,
            refresh_token = refresh_token,
            expires_in    = expires_in,
        )

    # ── Extraction du jti (JWT ID) ────────────────────────────────────────────
    def get_jti(self, token: str) -> Optional[str]:
        data = self.decode_unverified(token)
        return data.get("jti") if data else None

    # ── Temps restant avant expiration ────────────────────────────────────────
    def get_expiry_timestamp(self, token: str) -> Optional[int]:
        data = self.decode_unverified(token)
        return data.get("exp") if data else None