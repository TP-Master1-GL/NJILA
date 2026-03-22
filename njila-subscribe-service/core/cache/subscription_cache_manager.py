"""
Gestion des clés Redis du subscribe-service.
Toutes les clés suivent le schéma : njila:subscribe:<type>:<agenceId>
"""
import json
import logging

from django.core.cache import cache

logger = logging.getLogger(__name__)

_P = "njila:subscribe"


class SubscriptionCacheManager:

    # ── Constructeurs de clés ─────────────────────────────────────────────────

    @staticmethod
    def _k_status(agence_id):  return f"{_P}:status:{agence_id}"
    @staticmethod
    def _k_modules(agence_id): return f"{_P}:modules:{agence_id}"
    @staticmethod
    def _k_expiry(agence_id):  return f"{_P}:expiry:{agence_id}"
    @staticmethod
    def _k_blocked(agence_id): return f"{_P}:blocked:{agence_id}"
    @staticmethod
    def _k_trial(agence_id):   return f"{_P}:trial:{agence_id}"

    # ── Lecture / écriture ────────────────────────────────────────────────────

    @classmethod
    def mettre_a_jour_statut(cls, agence_id: str, statut: str,
                            ttl_secondes: int, modules: list = None,
                            expiry_iso: str = None):
        try:
            cache.set(cls._k_status(agence_id), statut, ttl_secondes)
            if modules is not None:
                cache.set(cls._k_modules(agence_id), json.dumps(modules), ttl_secondes)
            if expiry_iso:
                cache.set(cls._k_expiry(agence_id), expiry_iso, ttl_secondes)
        except Exception as e:
            logger.error(f"[CACHE] mettre_a_jour_statut {agence_id} : {e}")

    @classmethod
    def lire_statut(cls, agence_id: str) -> str | None:
        try:
            return cache.get(cls._k_status(agence_id))
        except Exception:
            return None

    @classmethod
    def lire_modules(cls, agence_id: str) -> list | None:
        try:
            raw = cache.get(cls._k_modules(agence_id))
            return json.loads(raw) if raw else None
        except Exception:
            return None

    @classmethod
    def invalider_cache(cls, agence_id: str):
        try:
            cache.delete(cls._k_status(agence_id))
            cache.delete(cls._k_modules(agence_id))
            cache.delete(cls._k_expiry(agence_id))
        except Exception as e:
            logger.error(f"[CACHE] invalider_cache {agence_id} : {e}")

    # ── Blocage manuel ────────────────────────────────────────────────────────

    @classmethod
    def bloquer_agence(cls, agence_id: str):
        try:
            cache.set(cls._k_blocked(agence_id), "true",   timeout=None)
            cache.set(cls._k_status(agence_id),  "SUSPENDED", timeout=None)
        except Exception as e:
            logger.error(f"[CACHE] bloquer_agence {agence_id} : {e}")

    @classmethod
    def debloquer_agence(cls, agence_id: str):
        try:
            cache.delete(cls._k_blocked(agence_id))
        except Exception as e:
            logger.error(f"[CACHE] debloquer_agence {agence_id} : {e}")

    @classmethod
    def est_bloque(cls, agence_id: str) -> bool:
        try:
            return cache.get(cls._k_blocked(agence_id)) == "true"
        except Exception:
            return False