"""
Tests unitaires — njila-auth-service v1.2
==========================================
20 cas de tests. Placez ce fichier dans authentication/tests_auth_service_v2.py

Exécution :
  python manage.py test authentication.tests_auth_service_v2 --verbosity=2
"""

import uuid
from datetime import timedelta
from unittest.mock import MagicMock, patch

from django.contrib.auth.hashers import check_password
from django.test import TestCase
from django.utils import timezone

from authentication.events.consumer import EventConsumer
from authentication.models import (
    AuthSession,
    DeactivationReason,
    NjilaUser,
    PasswordResetToken,
    Role,
)
from authentication.repositories.auth_repository import AuthRepository
from authentication.services.auth_service import (
    AccountInactiveError,
    AccountLockedError,
    AuthService,
    EmailAlreadyExistsError,
    InvalidCredentialsError,
    LoginCommand,
    RegisterCommand,
    SessionExpiredError,
    TokenInvalidError,
)
from authentication.services.jwt_service import JwtTokenService


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def make_service() -> AuthService:
    """AuthService avec Redis et RabbitMQ entièrement mockés."""
    svc = AuthService()
    svc._cache     = MagicMock()
    svc._publisher = MagicMock()
    svc._cache.session_exists.return_value = True
    svc._cache.is_blacklisted.return_value = False
    return svc


def make_voyageur(email="v@njila.cm", password="Pass1234!") -> NjilaUser:
    u = NjilaUser(email=email, role=Role.VOYAGEUR, is_active=True, is_verified=True)
    u.set_password(password)
    u.save()
    return u


def make_staff(
    email="staff@njila.cm",
    role=Role.GUICHETIER,
    agence_id=None,
    is_active=True,
    deactivation_reason=None,
    password="Pass1234!",
) -> NjilaUser:
    aid = agence_id or uuid.uuid4()
    u = NjilaUser(
        email               = email,
        role                = role,
        agence_id           = aid,
        filiale_id          = uuid.uuid4(),
        is_active           = is_active,
        is_verified         = True,
        deactivation_reason = deactivation_reason,
    )
    u.set_password(password)
    u.save()
    return u


# ══════════════════════════════════════════════════════════════════════════════
# TC-01 — Register voyageur avec photo de profil
# ══════════════════════════════════════════════════════════════════════════════
class TC01_RegisterSuccess(TestCase):
    """
    Cas    : Inscription voyageur avec tous les champs y compris photo_url.
    Entrée : email, password, nom, prenom, photo_url HTTPS valide.
    Sortie : accessToken + refreshToken non null, photo_url retournée,
             NjilaUser en base, événement RabbitMQ publié, session Redis sauvegardée.
    """
    def setUp(self):
        self.svc = make_service()

    def test_access_token_non_null(self):
        r = self.svc.register(RegisterCommand(
            email="tc01@njila.cm", password="Pass1234!", name="Jean", surname="Dupont",
            photo_url="https://cdn.njila.cm/jean.jpg",
        ))
        self.assertIsNotNone(r.token_pair.access_token)
        self.assertGreater(len(r.token_pair.access_token), 20)

    def test_refresh_token_non_null(self):
        r = self.svc.register(RegisterCommand(
            email="tc01b@njila.cm", password="Pass1234!", name="A", surname="B",
        ))
        self.assertIsNotNone(r.token_pair.refresh_token)

    def test_photo_url_dans_resultat(self):
        photo = "https://cdn.njila.cm/jean.jpg"
        r = self.svc.register(RegisterCommand(
            email="tc01c@njila.cm", password="Pass1234!", name="A", surname="B",
            photo_url=photo,
        ))
        self.assertEqual(r.photo_url, photo)

    def test_user_cree_en_base(self):
        self.svc.register(RegisterCommand(
            email="tc01d@njila.cm", password="Pass1234!", name="A", surname="B",
        ))
        self.assertTrue(NjilaUser.objects.filter(email="tc01d@njila.cm").exists())

    def test_role_voyageur(self):
        r = self.svc.register(RegisterCommand(
            email="tc01e@njila.cm", password="Pass1234!", name="A", surname="B",
        ))
        self.assertEqual(r.role, Role.VOYAGEUR)

    def test_evenement_rabbitmq_publie(self):
        self.svc.register(RegisterCommand(
            email="tc01f@njila.cm", password="Pass1234!", name="A", surname="B",
        ))
        self.svc._publisher.publish_user_registered.assert_called_once()

    def test_session_redis_sauvegardee(self):
        self.svc.register(RegisterCommand(
            email="tc01g@njila.cm", password="Pass1234!", name="A", surname="B",
        ))
        self.svc._cache.save_session.assert_called_once()


# ══════════════════════════════════════════════════════════════════════════════
# TC-02 — Register email dupliqué
# ══════════════════════════════════════════════════════════════════════════════
class TC02_RegisterDuplicateEmail(TestCase):
    """
    Cas    : Inscription avec un email déjà enregistré en base.
    Entrée : email="dup@njila.cm" (déjà présent), password, nom, prenom.
    Sortie : EmailAlreadyExistsError levée, message contient l'email,
             aucun doublon créé (count = 1).
    """
    def setUp(self):
        self.svc = make_service()
        self.svc.register(RegisterCommand(
            email="dup@njila.cm", password="Pass1234!", name="A", surname="B",
        ))

    def test_raises_email_already_exists(self):
        with self.assertRaises(EmailAlreadyExistsError):
            self.svc.register(RegisterCommand(
                email="dup@njila.cm", password="AutrePass!", name="C", surname="D",
            ))

    def test_aucun_doublon_cree(self):
        try:
            self.svc.register(RegisterCommand(
                email="dup@njila.cm", password="AutrePass!", name="C", surname="D",
            ))
        except EmailAlreadyExistsError:
            pass
        self.assertEqual(NjilaUser.objects.filter(email="dup@njila.cm").count(), 1)

    def test_message_contient_email(self):
        with self.assertRaises(EmailAlreadyExistsError) as ctx:
            self.svc.register(RegisterCommand(
                email="dup@njila.cm", password="AutrePass!", name="C", surname="D",
            ))
        self.assertIn("dup@njila.cm", str(ctx.exception))


# ══════════════════════════════════════════════════════════════════════════════
# TC-03 — Register : mot de passe haché
# ══════════════════════════════════════════════════════════════════════════════
class TC03_RegisterPasswordHashing(TestCase):
    """
    Cas    : Le mot de passe n'est jamais stocké en clair.
    Entrée : password="PlainText123!"
    Sortie : user.password ≠ texte clair, check_password(correct)=True,
             check_password(incorrect)=False.
    """
    def setUp(self):
        self.svc = make_service()
        self.svc.register(RegisterCommand(
            email="tc03@njila.cm", password="PlainText123!", name="A", surname="B",
        ))
        self.user = NjilaUser.objects.get(email="tc03@njila.cm")

    def test_mdp_non_stocke_en_clair(self):
        self.assertNotEqual(self.user.password, "PlainText123!")

    def test_texte_clair_absent_du_hash(self):
        self.assertNotIn("PlainText123!", self.user.password)

    def test_check_password_correct(self):
        self.assertTrue(check_password("PlainText123!", self.user.password))

    def test_check_password_incorrect(self):
        self.assertFalse(check_password("WrongPassword!", self.user.password))


# ══════════════════════════════════════════════════════════════════════════════
# TC-04 — Login succès complet
# ══════════════════════════════════════════════════════════════════════════════
class TC04_LoginSuccess(TestCase):
    """
    Cas    : Connexion réussie d'un voyageur.
    Entrée : email="tc04@njila.cm", password="Pass1234!", photo_url renseignée.
    Sortie : accessToken non null, email correct, photo_url retournée,
             last_login_at mis à jour, failed_attempts remis à 0.
    """
    def setUp(self):
        self.svc = make_service()
        self.svc.register(RegisterCommand(
            email="tc04@njila.cm", password="Pass1234!", name="A", surname="B",
            photo_url="https://cdn.njila.cm/tc04.jpg",
        ))

    def test_access_token_retourne(self):
        r = self.svc.login(LoginCommand("tc04@njila.cm", "Pass1234!"))
        self.assertIsNotNone(r.token_pair.access_token)

    def test_email_correct_dans_resultat(self):
        r = self.svc.login(LoginCommand("tc04@njila.cm", "Pass1234!"))
        self.assertEqual(r.email, "tc04@njila.cm")

    def test_photo_url_retournee(self):
        r = self.svc.login(LoginCommand("tc04@njila.cm", "Pass1234!"))
        self.assertEqual(r.photo_url, "https://cdn.njila.cm/tc04.jpg")

    def test_last_login_mis_a_jour(self):
        self.svc.login(LoginCommand("tc04@njila.cm", "Pass1234!"))
        self.assertIsNotNone(NjilaUser.objects.get(email="tc04@njila.cm").last_login_at)

    def test_failed_attempts_remis_a_zero(self):
        NjilaUser.objects.filter(email="tc04@njila.cm").update(failed_attempts=3)
        self.svc.login(LoginCommand("tc04@njila.cm", "Pass1234!"))
        self.assertEqual(NjilaUser.objects.get(email="tc04@njila.cm").failed_attempts, 0)


# ══════════════════════════════════════════════════════════════════════════════
# TC-05 — Login compte suspendu par admin
# ══════════════════════════════════════════════════════════════════════════════
class TC05_LoginAdminSuspended(TestCase):
    """
    Cas    : Login d'un compte suspendu manuellement (ADMIN_SUSPENDED).
    Entrée : is_active=False, deactivation_reason="ADMIN_SUSPENDED".
    Sortie : AccountInactiveError, message sans mention "abonnement",
             aucun token généré.
    """
    def setUp(self):
        self.svc = make_service()
        make_staff(
            email="tc05@njila.cm", role=Role.MANAGER_LOCAL,
            is_active=False, deactivation_reason=DeactivationReason.ADMIN_SUSPENDED,
        )

    def test_raises_account_inactive(self):
        with self.assertRaises(AccountInactiveError):
            self.svc.login(LoginCommand("tc05@njila.cm", "Pass1234!"))

    def test_message_generique_pas_abonnement(self):
        with self.assertRaises(AccountInactiveError) as ctx:
            self.svc.login(LoginCommand("tc05@njila.cm", "Pass1234!"))
        self.assertNotIn("abonnement", str(ctx.exception).lower())

    def test_aucun_token_genere(self):
        try:
            self.svc.login(LoginCommand("tc05@njila.cm", "Pass1234!"))
        except AccountInactiveError:
            pass
        self.svc._cache.save_session.assert_not_called()


# ══════════════════════════════════════════════════════════════════════════════
# TC-06 — Login abonnement expiré
# ══════════════════════════════════════════════════════════════════════════════
class TC06_LoginSubscriptionExpired(TestCase):
    """
    Cas    : Login d'un compte désactivé suite à expiration d'abonnement.
    Entrée : is_active=False, deactivation_reason="SUBSCRIPTION_EXPIRED".
    Sortie : AccountInactiveError, message contient "abonnement" et "manager",
             aucun token généré.
    """
    def setUp(self):
        self.svc = make_service()
        make_staff(
            email="tc06@njila.cm", role=Role.GUICHETIER,
            is_active=False, deactivation_reason=DeactivationReason.SUBSCRIPTION_EXPIRED,
        )

    def test_raises_account_inactive(self):
        with self.assertRaises(AccountInactiveError):
            self.svc.login(LoginCommand("tc06@njila.cm", "Pass1234!"))

    def test_message_contient_abonnement(self):
        with self.assertRaises(AccountInactiveError) as ctx:
            self.svc.login(LoginCommand("tc06@njila.cm", "Pass1234!"))
        self.assertIn("abonnement", str(ctx.exception).lower())

    def test_message_contient_manager(self):
        with self.assertRaises(AccountInactiveError) as ctx:
            self.svc.login(LoginCommand("tc06@njila.cm", "Pass1234!"))
        self.assertIn("manager", str(ctx.exception).lower())


# ══════════════════════════════════════════════════════════════════════════════
# TC-07 — Brute-force : 5 échecs consécutifs
# ══════════════════════════════════════════════════════════════════════════════
class TC07_BruteForceAccountLocking(TestCase):
    """
    Cas    : 5 tentatives de connexion avec mauvais mot de passe.
    Entrée : 5 appels login() avec password="MauvaisMotDePasse!".
    Sortie : is_locked()=True, failed_attempts=5, locked_until > now.
    """
    def setUp(self):
        self.svc = make_service()
        make_voyageur("tc07@njila.cm")

    def _fail(self):
        try:
            self.svc.login(LoginCommand("tc07@njila.cm", "MauvaisMotDePasse!"))
        except (InvalidCredentialsError, AccountLockedError):
            pass

    def test_compte_verrouille_apres_5_echecs(self):
        for _ in range(5):
            self._fail()
        self.assertTrue(NjilaUser.objects.get(email="tc07@njila.cm").is_locked())

    def test_failed_attempts_egale_5(self):
        for _ in range(5):
            self._fail()
        self.assertEqual(NjilaUser.objects.get(email="tc07@njila.cm").failed_attempts, 5)

    def test_locked_until_dans_le_futur(self):
        for _ in range(5):
            self._fail()
        self.assertGreater(
            NjilaUser.objects.get(email="tc07@njila.cm").locked_until,
            timezone.now(),
        )


# ══════════════════════════════════════════════════════════════════════════════
# TC-08 — Login compte verrouillé avec bon mot de passe
# ══════════════════════════════════════════════════════════════════════════════
class TC08_LoginLockedAccount(TestCase):
    """
    Cas    : Login avec mot de passe correct mais compte verrouillé.
    Entrée : failed_attempts=5, locked_until=now+15min, password correct.
    Sortie : AccountLockedError levée, aucun token généré.
    """
    def setUp(self):
        self.svc = make_service()
        user = make_voyageur("tc08@njila.cm")
        user.failed_attempts = 5
        user.locked_until    = timezone.now() + timedelta(minutes=15)
        user.save(update_fields=["failed_attempts", "locked_until"])

    def test_raises_account_locked(self):
        with self.assertRaises(AccountLockedError):
            self.svc.login(LoginCommand("tc08@njila.cm", "Pass1234!"))

    def test_aucun_token_genere(self):
        try:
            self.svc.login(LoginCommand("tc08@njila.cm", "Pass1234!"))
        except AccountLockedError:
            pass
        self.svc._cache.save_session.assert_not_called()


# ══════════════════════════════════════════════════════════════════════════════
# TC-09 — Logout : JTI blacklisté + session révoquée
# ══════════════════════════════════════════════════════════════════════════════
class TC09_LogoutBlacklistAndRevoke(TestCase):
    """
    Cas    : Déconnexion normale d'un utilisateur connecté.
    Entrée : access_token valide, is_blacklisted()=False.
    Sortie : blacklist_token() appelé 1×, delete_session() appelé,
             session DB is_active=False.
    """
    def setUp(self):
        self.svc = make_service()
        r = self.svc.register(RegisterCommand(
            email="tc09@njila.cm", password="Pass1234!", name="A", surname="B",
        ))
        self.token = r.token_pair.access_token

    def test_blacklist_token_appele(self):
        self.svc.logout(self.token)
        self.svc._cache.blacklist_token.assert_called_once()

    def test_delete_session_appele(self):
        self.svc.logout(self.token)
        self.svc._cache.delete_session.assert_called_once()

    def test_session_db_invalidee(self):
        jwt = JwtTokenService()
        session_id = jwt.decode(self.token).session_id
        self.svc.logout(self.token)
        self.assertIsNone(
            AuthSession.objects.filter(session_id=session_id, is_active=True).first()
        )


# ══════════════════════════════════════════════════════════════════════════════
# TC-10 — Logout token déjà révoqué
# ══════════════════════════════════════════════════════════════════════════════
class TC10_LogoutAlreadyRevoked(TestCase):
    """
    Cas    : Tentative de logout avec un token dont le JTI est déjà blacklisté.
    Entrée : access_token valide, is_blacklisted()=True (simulé).
    Sortie : TokenInvalidError levée, blacklist_token() NON rappelé.
    """
    def setUp(self):
        self.svc = make_service()
        r = self.svc.register(RegisterCommand(
            email="tc10@njila.cm", password="Pass1234!", name="A", surname="B",
        ))
        self.token = r.token_pair.access_token
        self.svc._cache.is_blacklisted.return_value = True

    def test_raises_token_invalid(self):
        with self.assertRaises(TokenInvalidError):
            self.svc.logout(self.token)

    def test_blacklist_non_rappele(self):
        try:
            self.svc.logout(self.token)
        except TokenInvalidError:
            pass
        self.svc._cache.blacklist_token.assert_not_called()


# ══════════════════════════════════════════════════════════════════════════════
# TC-11 — Refresh token : nouveau access token valide
# ══════════════════════════════════════════════════════════════════════════════
class TC11_RefreshSuccess(TestCase):
    """
    Cas    : Renouvellement d'access token avec refresh token valide.
    Entrée : refresh_token valide, session_exists()=True.
    Sortie : nouveau access_token ≠ ancien, refresh_token inchangé,
             nouveau access_token valide (JWT).
    """
    def setUp(self):
        self.svc = make_service()
        r = self.svc.register(RegisterCommand(
            email="tc11@njila.cm", password="Pass1234!", name="A", surname="B",
        ))
        self.old_access  = r.token_pair.access_token
        self.refresh_tok = r.token_pair.refresh_token

    def test_nouveau_access_token_different(self):
        pair = self.svc.refresh(self.refresh_tok)
        self.assertNotEqual(pair.access_token, self.old_access)

    def test_refresh_token_inchange(self):
        pair = self.svc.refresh(self.refresh_tok)
        self.assertEqual(pair.refresh_token, self.refresh_tok)

    def test_nouveau_access_token_valide(self):
        pair = self.svc.refresh(self.refresh_tok)
        self.assertTrue(JwtTokenService().validate(pair.access_token))


# ══════════════════════════════════════════════════════════════════════════════
# TC-12 — Refresh : session Redis absente
# ══════════════════════════════════════════════════════════════════════════════
class TC12_RefreshExpiredSession(TestCase):
    """
    Cas    : Refresh token valide mais session absente de Redis.
    Entrée : refresh_token valide, session_exists()=False (simulé).
    Sortie : SessionExpiredError levée.
    """
    def setUp(self):
        self.svc = make_service()
        r = self.svc.register(RegisterCommand(
            email="tc12@njila.cm", password="Pass1234!", name="A", surname="B",
        ))
        self.refresh_tok = r.token_pair.refresh_token
        self.svc._cache.session_exists.return_value = False

    def test_raises_session_expired(self):
        with self.assertRaises(SessionExpiredError):
            self.svc.refresh(self.refresh_tok)


# ══════════════════════════════════════════════════════════════════════════════
# TC-13 — subscription.expired : staff désactivé, VOYAGEUR ignoré
# ══════════════════════════════════════════════════════════════════════════════
class TC13_SubscriptionExpiredStaffDeactivated(TestCase):
    """
    Cas    : Réception de subscription.expired pour une agence.
    Entrée : agenceId avec 1 GUICHETIER actif, 1 MANAGER_LOCAL actif,
             1 VOYAGEUR actif (même agenceId).
    Sortie : GUICHETIER.is_active=False, MANAGER_LOCAL.is_active=False,
             deactivation_reason='SUBSCRIPTION_EXPIRED',
             VOYAGEUR.is_active=True (non touché).
    """
    def setUp(self):
        self.agence_id  = str(uuid.uuid4())
        self.guichetier = make_staff("g13@njila.cm", Role.GUICHETIER, agence_id=self.agence_id)
        self.manager    = make_staff("m13@njila.cm", Role.MANAGER_LOCAL, agence_id=self.agence_id)
        self.voyageur   = make_voyageur("voy13@njila.cm")
        # Voyageur avec même agenceId (cas à protéger)
        self.voyageur.agence_id = self.agence_id
        self.voyageur.save(update_fields=["agence_id"])
        self.consumer = EventConsumer()

    @patch("authentication.events.consumer.RedisSessionCache")
    def test_staff_desactive(self, MockCache):
        MockCache.return_value = MagicMock()
        self.consumer._handle_subscription_expired({"agenceId": self.agence_id})
        self.guichetier.refresh_from_db()
        self.manager.refresh_from_db()
        self.assertFalse(self.guichetier.is_active)
        self.assertFalse(self.manager.is_active)

    @patch("authentication.events.consumer.RedisSessionCache")
    def test_voyageur_non_touche(self, MockCache):
        MockCache.return_value = MagicMock()
        self.consumer._handle_subscription_expired({"agenceId": self.agence_id})
        self.voyageur.refresh_from_db()
        self.assertTrue(self.voyageur.is_active)

    @patch("authentication.events.consumer.RedisSessionCache")
    def test_raison_desactivation_correcte(self, MockCache):
        MockCache.return_value = MagicMock()
        self.consumer._handle_subscription_expired({"agenceId": self.agence_id})
        self.guichetier.refresh_from_db()
        self.assertEqual(
            self.guichetier.deactivation_reason,
            DeactivationReason.SUBSCRIPTION_EXPIRED,
        )


# ══════════════════════════════════════════════════════════════════════════════
# TC-14 — subscription.expired : sessions DB invalidées
# ══════════════════════════════════════════════════════════════════════════════
class TC14_SubscriptionExpiredSessionsDB(TestCase):
    """
    Cas    : Les sessions DB actives sont invalidées lors de l'expiration.
    Entrée : GUICHETIER avec 2 sessions actives en base.
    Sortie : 0 session active en base après l'événement.
    """
    def setUp(self):
        self.agence_id = str(uuid.uuid4())
        self.staff     = make_staff("s14@njila.cm", Role.GUICHETIER, agence_id=self.agence_id)
        for i in range(2):
            AuthSession.objects.create(
                session_id    = uuid.uuid4(),
                user          = self.staff,
                access_token  = f"acc{i}",
                refresh_token = f"ref{i}",
                expires_at    = timezone.now() + timedelta(days=7),
                is_active     = True,
            )
        self.consumer = EventConsumer()

    @patch("authentication.events.consumer.RedisSessionCache")
    def test_sessions_db_invalidees(self, MockCache):
        MockCache.return_value = MagicMock()
        self.consumer._handle_subscription_expired({"agenceId": self.agence_id})
        active = AuthSession.objects.filter(user=self.staff, is_active=True).count()
        self.assertEqual(active, 0)


# ══════════════════════════════════════════════════════════════════════════════
# TC-15 — subscription.expired : sessions Redis supprimées par user
# ══════════════════════════════════════════════════════════════════════════════
class TC15_SubscriptionExpiredSessionsRedis(TestCase):
    """
    Cas    : Les sessions Redis sont supprimées pour chaque user désactivé.
    Entrée : agenceId avec 3 users staff actifs.
    Sortie : delete_all_user_sessions() appelé 3×, delete_refresh_token() appelé 3×.
    """
    def setUp(self):
        self.agence_id = str(uuid.uuid4())
        for i in range(3):
            make_staff(f"u{i}15@njila.cm", Role.GUICHETIER, agence_id=self.agence_id)
        self.consumer = EventConsumer()

    @patch("authentication.events.consumer.RedisSessionCache")
    def test_redis_supprime_par_user(self, MockCache):
        mock_redis = MagicMock()
        MockCache.return_value = mock_redis
        self.consumer._handle_subscription_expired({"agenceId": self.agence_id})
        self.assertEqual(mock_redis.delete_all_user_sessions.call_count, 3)
        self.assertEqual(mock_redis.delete_refresh_token.call_count, 3)


# ══════════════════════════════════════════════════════════════════════════════
# TC-16 — subscription.renewed : réactivation SUBSCRIPTION_EXPIRED
# ══════════════════════════════════════════════════════════════════════════════
class TC16_SubscriptionRenewedReactivatesExpired(TestCase):
    """
    Cas    : Renouvellement d'abonnement — réactivation des comptes SUBSCRIPTION_EXPIRED.
    Entrée : GUICHETIER + MANAGER_LOCAL désactivés pour SUBSCRIPTION_EXPIRED.
    Sortie : is_active=True, deactivation_reason=None pour les deux.
    """
    def setUp(self):
        self.agence_id = str(uuid.uuid4())
        self.g = make_staff("g16@njila.cm", Role.GUICHETIER, agence_id=self.agence_id,
                            is_active=False,
                            deactivation_reason=DeactivationReason.SUBSCRIPTION_EXPIRED)
        self.m = make_staff("m16@njila.cm", Role.MANAGER_LOCAL, agence_id=self.agence_id,
                            is_active=False,
                            deactivation_reason=DeactivationReason.SUBSCRIPTION_EXPIRED)
        self.consumer = EventConsumer()

    def test_users_reactives(self):
        self.consumer._handle_subscription_renewed({
            "agenceId": self.agence_id, "newExpiresAt": "2027-01-01",
        })
        self.g.refresh_from_db()
        self.m.refresh_from_db()
        self.assertTrue(self.g.is_active)
        self.assertTrue(self.m.is_active)

    def test_raison_effacee(self):
        self.consumer._handle_subscription_renewed({
            "agenceId": self.agence_id, "newExpiresAt": "2027-01-01",
        })
        self.g.refresh_from_db()
        self.assertIsNone(self.g.deactivation_reason)


# ══════════════════════════════════════════════════════════════════════════════
# TC-17 — subscription.renewed : ADMIN_SUSPENDED non réactivé
# ══════════════════════════════════════════════════════════════════════════════
class TC17_SubscriptionRenewedDoesNotReactivateAdminSuspended(TestCase):
    """
    Cas    : Le renouvellement ne réactive PAS les comptes ADMIN_SUSPENDED.
    Entrée : GUICHETIER (SUBSCRIPTION_EXPIRED) + MANAGER_GLOBAL (ADMIN_SUSPENDED).
    Sortie : GUICHETIER réactivé, MANAGER_GLOBAL toujours inactif avec ADMIN_SUSPENDED.
    """
    def setUp(self):
        self.agence_id = str(uuid.uuid4())
        self.g = make_staff("g17@njila.cm", Role.GUICHETIER, agence_id=self.agence_id,
                            is_active=False,
                            deactivation_reason=DeactivationReason.SUBSCRIPTION_EXPIRED)
        self.ms = make_staff("ms17@njila.cm", Role.MANAGER_GLOBAL, agence_id=self.agence_id,
                             is_active=False,
                             deactivation_reason=DeactivationReason.ADMIN_SUSPENDED)
        self.consumer = EventConsumer()

    def test_subscription_expired_reactivated(self):
        self.consumer._handle_subscription_renewed({
            "agenceId": self.agence_id, "newExpiresAt": "2027-01-01",
        })
        self.g.refresh_from_db()
        self.assertTrue(self.g.is_active)

    def test_admin_suspended_reste_inactif(self):
        self.consumer._handle_subscription_renewed({
            "agenceId": self.agence_id, "newExpiresAt": "2027-01-01",
        })
        self.ms.refresh_from_db()
        self.assertFalse(self.ms.is_active)

    def test_raison_admin_suspended_inchangee(self):
        self.consumer._handle_subscription_renewed({
            "agenceId": self.agence_id, "newExpiresAt": "2027-01-01",
        })
        self.ms.refresh_from_db()
        self.assertEqual(self.ms.deactivation_reason, DeactivationReason.ADMIN_SUSPENDED)


# ══════════════════════════════════════════════════════════════════════════════
# TC-18 — validate_token : token blacklisté → None
# ══════════════════════════════════════════════════════════════════════════════
class TC18_ValidateBlacklistedToken(TestCase):
    """
    Cas    : validate_token() avec un token blacklisté (usage API Gateway).
    Entrée : access_token valide, is_blacklisted()=True (simulé).
    Sortie : None retourné. Token non blacklisté → payload non null.
    """
    def setUp(self):
        self.svc = make_service()
        r = self.svc.register(RegisterCommand(
            email="tc18@njila.cm", password="Pass1234!", name="A", surname="B",
        ))
        self.token = r.token_pair.access_token
        self.svc._cache.is_blacklisted.return_value = True

    def test_token_blackliste_retourne_none(self):
        self.assertIsNone(self.svc.validate_token(self.token))

    def test_token_valide_retourne_payload(self):
        self.svc._cache.is_blacklisted.return_value = False
        payload = self.svc.validate_token(self.token)
        self.assertIsNotNone(payload)
        self.assertEqual(payload.role, Role.VOYAGEUR)


# ══════════════════════════════════════════════════════════════════════════════
# TC-19 — update_photo : persistance DB + événement user-service
# ══════════════════════════════════════════════════════════════════════════════
class TC19_UpdatePhoto(TestCase):
    """
    Cas    : Mise à jour de la photo de profil.
    Entrée : user_id valide, photo_url="https://cdn.njila.cm/new.jpg".
    Sortie : user.photo_url mis à jour en DB, publish_user_updated() appelé 1×
             avec photo_url correct et email_changed=False.
             ValueError si user_id inconnu.
    """
    def setUp(self):
        self.svc = make_service()
        r = self.svc.register(RegisterCommand(
            email="tc19@njila.cm", password="Pass1234!", name="A", surname="B",
        ))
        self.user_id   = r.user_id
        self.new_photo = "https://cdn.njila.cm/new.jpg"

    def test_photo_url_mis_a_jour_en_db(self):
        self.svc.update_photo(self.user_id, self.new_photo)
        self.assertEqual(
            NjilaUser.objects.get(id=self.user_id).photo_url,
            self.new_photo,
        )

    def test_publish_user_updated_appele(self):
        self.svc.update_photo(self.user_id, self.new_photo)
        self.svc._publisher.publish_user_updated.assert_called_once()

    def test_event_contient_photo_url(self):
        self.svc.update_photo(self.user_id, self.new_photo)
        kwargs = self.svc._publisher.publish_user_updated.call_args.kwargs
        self.assertEqual(kwargs.get("photo_url"), self.new_photo)

    def test_event_email_changed_false(self):
        self.svc.update_photo(self.user_id, self.new_photo)
        kwargs = self.svc._publisher.publish_user_updated.call_args.kwargs
        self.assertFalse(kwargs.get("email_changed"))

    def test_user_inconnu_raises_value_error(self):
        with self.assertRaises(ValueError):
            self.svc.update_photo(str(uuid.uuid4()), self.new_photo)


# ══════════════════════════════════════════════════════════════════════════════
# TC-20 — Reset password : token à usage unique + invalidation sessions
# ══════════════════════════════════════════════════════════════════════════════
class TC20_ResetPasswordSingleUse(TestCase):
    """
    Cas    : Un token de reset ne peut être utilisé qu'une seule fois.
    Entrée : token de reset valide.
             1re utilisation : new_password="NewPass456!"
             2e utilisation : même token.
    Sortie : 1re : mdp changé, ancien invalide, token.used=True,
                   delete_all_user_sessions() et delete_refresh_token() appelés.
             2e : TokenInvalidError levée.
    """
    def setUp(self):
        self.svc  = make_service()
        self.svc.register(RegisterCommand(
            email="tc20@njila.cm", password="OldPass123!", name="A", surname="B",
        ))
        self.user  = NjilaUser.objects.get(email="tc20@njila.cm")
        self.token = AuthRepository().create_reset_token(self.user)

    def test_premier_usage_change_le_mdp(self):
        self.svc.confirm_password_reset(self.token.token, "NewPass456!")
        self.user.refresh_from_db()
        self.assertTrue(check_password("NewPass456!", self.user.password))

    def test_ancien_mdp_invalide(self):
        self.svc.confirm_password_reset(self.token.token, "NewPass456!")
        self.user.refresh_from_db()
        self.assertFalse(check_password("OldPass123!", self.user.password))

    def test_token_marque_used(self):
        self.svc.confirm_password_reset(self.token.token, "NewPass456!")
        self.token.refresh_from_db()
        self.assertTrue(self.token.used)

    def test_deuxieme_usage_raises_token_invalid(self):
        self.svc.confirm_password_reset(self.token.token, "NewPass456!")
        with self.assertRaises(TokenInvalidError):
            self.svc.confirm_password_reset(self.token.token, "AnotherPass789!")

    def test_sessions_invalidees(self):
        self.svc.confirm_password_reset(self.token.token, "NewPass456!")
        self.svc._cache.delete_all_user_sessions.assert_called_once()

    def test_refresh_token_supprime(self):
        self.svc.confirm_password_reset(self.token.token, "NewPass456!")
        self.svc._cache.delete_refresh_token.assert_called_once()