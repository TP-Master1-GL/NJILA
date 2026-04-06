"""
Tests unitaires — SubscriptionCacheManager (Redis)
"""
from django.test import TestCase
from unittest.mock import patch, MagicMock
from core.cache.subscription_cache_manager import SubscriptionCacheManager


class CacheManagerTest(TestCase):

    def test_mettre_a_jour_et_lire_statut(self):
        SubscriptionCacheManager.mettre_a_jour_statut(
            "AGC-CACHE-001", "ACTIVE", 3600,
            ["BOOKING", "SEARCH"], "2026-04-21T00:00:00"
        )
        statut = SubscriptionCacheManager.lire_statut("AGC-CACHE-001")
        self.assertEqual(statut, "ACTIVE")

    def test_lire_modules(self):
        SubscriptionCacheManager.mettre_a_jour_statut(
            "AGC-CACHE-002", "ACTIVE", 3600,
            ["BOOKING", "FLEET"], "2026-04-21T00:00:00"
        )
        modules = SubscriptionCacheManager.lire_modules("AGC-CACHE-002")
        self.assertIn("BOOKING", modules)
        self.assertIn("FLEET",   modules)

    def test_invalider_cache(self):
        SubscriptionCacheManager.mettre_a_jour_statut(
            "AGC-CACHE-003", "ACTIVE", 3600
        )
        SubscriptionCacheManager.invalider_cache("AGC-CACHE-003")
        statut = SubscriptionCacheManager.lire_statut("AGC-CACHE-003")
        self.assertIsNone(statut)

    def test_bloquer_agence(self):
        SubscriptionCacheManager.bloquer_agence("AGC-CACHE-004")
        self.assertTrue(SubscriptionCacheManager.est_bloque("AGC-CACHE-004"))
        statut = SubscriptionCacheManager.lire_statut("AGC-CACHE-004")
        self.assertEqual(statut, "SUSPENDED")

    def test_debloquer_agence(self):
        SubscriptionCacheManager.bloquer_agence("AGC-CACHE-005")
        SubscriptionCacheManager.debloquer_agence("AGC-CACHE-005")
        self.assertFalse(SubscriptionCacheManager.est_bloque("AGC-CACHE-005"))

    def test_agence_non_bloquee_par_defaut(self):
        self.assertFalse(SubscriptionCacheManager.est_bloque("AGC-JAMAIS-VU"))

    def test_statut_absent_retourne_none(self):
        statut = SubscriptionCacheManager.lire_statut("AGC-INEXISTANT-999")
        self.assertIsNone(statut)

    def test_modules_absents_retournent_none(self):
        modules = SubscriptionCacheManager.lire_modules("AGC-INEXISTANT-999")
        self.assertIsNone(modules)