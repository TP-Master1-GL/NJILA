
import json
import logging
from typing import Optional

from django.core.cache import cache

logger = logging.getLogger(__name__)

SESSION_PREFIX       = "njila:auth:session:"       # njila:auth:session:{sessionId}
BLACKLIST_PREFIX     = "njila:auth:blacklist:"     # njila:auth:blacklist:{jti}
REFRESH_PREFIX       = "njila:auth:refresh:"       # njila:auth:refresh:{userId}
USER_SESSIONS_PREFIX = "njila:auth:usersessions:"  # njila:auth:usersessions:{userId}
RESET_PREFIX         = "njila:auth:reset:"         # njila:auth:reset:{token}


class RedisSessionCache:
    
    # ── Sessions ──────────────────────────────────────────────────────────────
    def save_session(self, session_id: str, user_id: str, data: dict, ttl_seconds: int):
        
        key = f"{SESSION_PREFIX}{session_id}"
        cache.set(key, json.dumps(data), timeout=ttl_seconds)

        # Index des sessions actives par utilisateur
        user_key  = f"{USER_SESSIONS_PREFIX}{user_id}"
        raw       = cache.get(user_key)
        sessions  = json.loads(raw) if raw else []
        if session_id not in sessions:
            sessions.append(session_id)
        cache.set(user_key, json.dumps(sessions), timeout=ttl_seconds)

        logger.debug("[REDIS] Session sauvegardée  njila:auth:session:%s (TTL=%ds)",
                     session_id, ttl_seconds)

    def get_session(self, session_id: str) -> Optional[dict]:
        raw = cache.get(f"{SESSION_PREFIX}{session_id}")
        if raw is None:
            return None
        try:
            return json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            return None

    def delete_session(self, session_id: str, user_id: str = None):
        cache.delete(f"{SESSION_PREFIX}{session_id}")
        if user_id:
            user_key = f"{USER_SESSIONS_PREFIX}{user_id}"
            raw      = cache.get(user_key)
            if raw:
                sessions = [s for s in json.loads(raw) if s != session_id]
                cache.set(user_key, json.dumps(sessions), timeout=None)
        logger.debug("[REDIS] Session supprimée  njila:auth:session:%s", session_id)

    def delete_all_user_sessions(self, user_id: str):
        user_key = f"{USER_SESSIONS_PREFIX}{user_id}"
        raw      = cache.get(user_key)
        if raw:
            sessions = json.loads(raw)
            for sid in sessions:
                cache.delete(f"{SESSION_PREFIX}{sid}")
            cache.delete(user_key)
            logger.debug("[REDIS] %d sessions supprimées pour user %s", len(sessions), user_id)

    def session_exists(self, session_id: str) -> bool:
        return cache.get(f"{SESSION_PREFIX}{session_id}") is not None

    # ── Blacklist JWT ─────────────────────────────────────────────────────────
    def blacklist_token(self, jti: str, ttl_seconds: int):
       
        cache.set(f"{BLACKLIST_PREFIX}{jti}", "1", timeout=ttl_seconds)
        logger.debug("[REDIS] Token blacklisté  njila:auth:blacklist:%s (TTL=%ds)",
                     jti, ttl_seconds)

    def is_blacklisted(self, jti: str) -> bool:
        return cache.get(f"{BLACKLIST_PREFIX}{jti}") is not None

    # ── Refresh token actif ───────────────────────────────────────────────────
    def save_refresh_token(self, user_id: str, refresh_jti: str, ttl_seconds: int = 604800):
        
        cache.set(f"{REFRESH_PREFIX}{user_id}", refresh_jti, timeout=ttl_seconds)

    def get_refresh_token_jti(self, user_id: str) -> Optional[str]:
        return cache.get(f"{REFRESH_PREFIX}{user_id}")

    def delete_refresh_token(self, user_id: str):
        cache.delete(f"{REFRESH_PREFIX}{user_id}")
        logger.debug("[REDIS] Refresh token supprimé  njila:auth:refresh:%s", user_id)

    # ── Reset password ────────────────────────────────────────────────────────
    def save_reset_token(self, email: str, token: str, ttl_seconds: int = 3600):
        """Clé : njila:auth:reset:{token}    TTL = 1h"""
        cache.set(f"{RESET_PREFIX}{token}", email, timeout=ttl_seconds)

    def get_reset_token_email(self, token: str) -> Optional[str]:
        return cache.get(f"{RESET_PREFIX}{token}")

    def delete_reset_token(self, token: str):
        cache.delete(f"{RESET_PREFIX}{token}")