"""
core/crypto/rsa_service.py
Chiffrement hybride RSA-2048 + AES-256-GCM.
RSA chiffre la clé AES (32 octets), AES chiffre le payload JSON (taille illimitée).
"""
import json
import hashlib
import base64
import secrets
import os

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.backends import default_backend

RSA_KEY_SIZE = 2048


def generate_rsa_keypair() -> tuple[str, str]:
    """
    Retourne (private_key_pem, public_key_pem).
    La clé privée doit être envoyée à l'agence puis supprimée des serveurs NJILA.
    """
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=RSA_KEY_SIZE,
        backend=default_backend(),
    )
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode()

    public_pem = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode()

    return private_pem, public_pem


def get_public_key_fingerprint(public_key_pem: str) -> str:
    return hashlib.sha256(public_key_pem.encode()).hexdigest()[:32]


def build_activation_payload(agence_id: str, plan: str,
                            date_expiration: str, modules: list) -> dict:
    nonce   = secrets.token_hex(16)
    payload = {
        "agenceId":       agence_id,
        "plan":           plan,
        "dateExpiration": date_expiration,
        "modules":        modules,
        "nonce":          nonce,
    }
    payload["hash"] = hashlib.sha256(
        json.dumps(payload, sort_keys=True).encode()
    ).hexdigest()
    return payload


def encrypt_activation_key(payload: dict, public_key_pem: str) -> str:
    """
    Chiffrement hybride RSA-2048 + AES-256-GCM :
1. Génère une clé AES-256 aléatoire
2. Chiffre le payload JSON avec AES-GCM
3. Chiffre la clé AES avec RSA-OAEP
4. Retourne base64(rsa_encrypted_aes_key | aes_nonce | aes_ciphertext)
    """
    # Charger la clé publique RSA
    public_key = serialization.load_pem_public_key(
        public_key_pem.encode(), backend=default_backend()
    )

    # 1. Générer clé AES-256 aléatoire
    aes_key = os.urandom(32)

    # 2. Chiffrer le payload avec AES-256-GCM
    aes_nonce      = os.urandom(12)
    aesgcm         = AESGCM(aes_key)
    payload_bytes  = json.dumps(payload).encode()
    aes_ciphertext = aesgcm.encrypt(aes_nonce, payload_bytes, None)

    # 3. Chiffrer la clé AES avec RSA-OAEP (32 octets << 190 octets max)
    rsa_encrypted_aes_key = public_key.encrypt(
        aes_key,
        padding.OAEP(
            mgf=padding.MGF1(algorithm=hashes.SHA256()),
            algorithm=hashes.SHA256(),
            label=None,
        ),
    )

    # 4. Concaténer et encoder en base64
    result = rsa_encrypted_aes_key + aes_nonce + aes_ciphertext
    return base64.b64encode(result).decode()


def decrypt_activation_key(cle_chiffree: str, private_key_pem: str) -> dict:
    """Déchiffre la clé d'activation avec la clé privée RSA (usage agence)."""
    private_key = serialization.load_pem_private_key(
        private_key_pem.encode(), password=None, backend=default_backend()
    )

    data = base64.b64decode(cle_chiffree)

    # RSA 2048 = 256 octets | nonce AES-GCM = 12 octets | reste = ciphertext
    rsa_encrypted_aes_key = data[:256]
    aes_nonce             = data[256:268]
    aes_ciphertext        = data[268:]

    # Déchiffrer la clé AES
    aes_key = private_key.decrypt(
        rsa_encrypted_aes_key,
        padding.OAEP(
            mgf=padding.MGF1(algorithm=hashes.SHA256()),
            algorithm=hashes.SHA256(),
            label=None,
        ),
    )

    # Déchiffrer le payload
    aesgcm  = AESGCM(aes_key)
    payload = aesgcm.decrypt(aes_nonce, aes_ciphertext, None)
    return json.loads(payload.decode())


def validate_hash(payload: dict) -> bool:
    received_hash = payload.pop("hash", None)
    computed      = hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()
    payload["hash"] = received_hash
    return received_hash == computed