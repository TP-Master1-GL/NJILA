"""
Tests unitaires — RSA 2048 + AES-256-GCM
"""
from django.test import TestCase
from core.crypto.rsa_service import (
    generate_rsa_keypair,
    get_public_key_fingerprint,
    build_activation_payload,
    encrypt_activation_key,
    decrypt_activation_key,
    validate_hash,
)


class RSAKeyTest(TestCase):

    def test_generation_paire_rsa(self):
        private_pem, public_pem = generate_rsa_keypair()
        self.assertIn("-----BEGIN PRIVATE KEY-----", private_pem)
        self.assertIn("-----BEGIN PUBLIC KEY-----",  public_pem)

    def test_cles_differentes_a_chaque_generation(self):
        private1, public1 = generate_rsa_keypair()
        private2, public2 = generate_rsa_keypair()
        self.assertNotEqual(private1, private2)
        self.assertNotEqual(public1,  public2)

    def test_fingerprint_longueur(self):
        _, public_pem = generate_rsa_keypair()
        fp = get_public_key_fingerprint(public_pem)
        self.assertEqual(len(fp), 32)

    def test_fingerprint_deterministe(self):
        _, public_pem = generate_rsa_keypair()
        fp1 = get_public_key_fingerprint(public_pem)
        fp2 = get_public_key_fingerprint(public_pem)
        self.assertEqual(fp1, fp2)


class ActivationKeyTest(TestCase):

    def setUp(self):
        self.private_pem, self.public_pem = generate_rsa_keypair()
        self.payload = build_activation_payload(
            agence_id="AGC-001",
            plan="MENSUEL",
            date_expiration="2026-04-21T00:00:00",
            modules=["BOOKING", "SEARCH", "FLEET", "NOTIFICATION"],
        )

    def test_payload_contient_champs_requis(self):
        self.assertIn("agenceId",       self.payload)
        self.assertIn("plan",           self.payload)
        self.assertIn("dateExpiration", self.payload)
        self.assertIn("modules",        self.payload)
        self.assertIn("nonce",          self.payload)
        self.assertIn("hash",           self.payload)

    def test_nonce_unique_a_chaque_appel(self):
        payload1 = build_activation_payload("AGC-001", "MENSUEL", "2026-04-21", ["BOOKING"])
        payload2 = build_activation_payload("AGC-001", "MENSUEL", "2026-04-21", ["BOOKING"])
        self.assertNotEqual(payload1["nonce"], payload2["nonce"])

    def test_validate_hash_valide(self):
        payload_copy = self.payload.copy()
        self.assertTrue(validate_hash(payload_copy))

    def test_validate_hash_falsifie(self):
        payload_falsifie = self.payload.copy()
        payload_falsifie["plan"] = "ANNUEL"  # Falsification
        self.assertFalse(validate_hash(payload_falsifie))

    def test_chiffrement_dechiffrement(self):
        cle_chiffree = encrypt_activation_key(self.payload, self.public_pem)
        self.assertIsInstance(cle_chiffree, str)
        self.assertGreater(len(cle_chiffree), 0)

        payload_dechiffre = decrypt_activation_key(cle_chiffree, self.private_pem)
        self.assertEqual(payload_dechiffre["agenceId"], "AGC-001")
        self.assertEqual(payload_dechiffre["plan"],     "MENSUEL")
        self.assertEqual(payload_dechiffre["modules"],  ["BOOKING", "SEARCH", "FLEET", "NOTIFICATION"])

    def test_chiffrement_grand_payload(self):
        """Vérifie que le chiffrement hybride gère des payloads volumineux."""
        modules_list = ["BOOKING", "SEARCH", "FLEET", "NOTIFICATION", "REPORTING"]
        payload = build_activation_payload("AGC-LONG", "ANNUEL", "2027-01-01", modules_list)
        cle_chiffree     = encrypt_activation_key(payload, self.public_pem)
        payload_retour   = decrypt_activation_key(cle_chiffree, self.private_pem)
        self.assertEqual(payload_retour["agenceId"], "AGC-LONG")
        self.assertEqual(payload_retour["modules"],  modules_list)

    def test_mauvaise_cle_privee_echoue(self):
        """Déchiffrer avec une mauvaise clé doit lever une exception."""
        cle_chiffree  = encrypt_activation_key(self.payload, self.public_pem)
        autre_private, _ = generate_rsa_keypair()
        with self.assertRaises(Exception):
            decrypt_activation_key(cle_chiffree, autre_private)