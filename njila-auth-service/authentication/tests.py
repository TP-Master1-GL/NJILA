"""
Tests unitaires — njila-auth-service v1.3
==========================================
30+ cas de tests. Placez ce fichier dans authentication/tests_auth_service_v2.py

Exécution :
  python manage.py test authentication.tests --verbosity=2
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
from authentication.middleware.auth_middleware import (
    NjilaJWTAuthentication,
    IsAdministrateur,
    IsManagerGlobal,
    IsManagerLocal,
    IsGuichetier,
    IsInternalService,
    require_roles,
    AuthenticatedUser,
)
from authentication.serializers.auth_serializers import (
    RegisterSerializer,
    LoginSerializer,
    RefreshSerializer,
    ForgotPasswordSerializer,
    ResetPasswordSerializer,
    ValidateTokenSerializer,
    AccountStatusSerializer,
    PhotoUpdateSerializer,
    ProfileUpdateSerializer,
    UserMeSerializer,
)
from authentication.services.jwt_service import TokenPayload

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


# ══════════════════════════════════════════════════════════════════════════════
# TC-21 — Register : validation des champs name et surname
# ══════════════════════════════════════════════════════════════════════════════
class TC21_RegisterNameSurnameValidation(TestCase):
    """
    Cas    : Vérification que name et surname sont obligatoires et non vides.
    Entrée : name vide ou absent, surname vide ou absent.
    Sortie : ValidationError avec messages appropriés.
    """
    def test_name_obligatoire(self):
        serializer = RegisterSerializer(data={
            "email": "test@njila.cm",
            "password": "Pass1234!",
            "surname": "Dupont",
        })
        self.assertFalse(serializer.is_valid())
        self.assertIn("name", serializer.errors)

    def test_surname_obligatoire(self):
        serializer = RegisterSerializer(data={
            "email": "test@njila.cm",
            "password": "Pass1234!",
            "name": "Jean",
        })
        self.assertFalse(serializer.is_valid())
        self.assertIn("surname", serializer.errors)

    def test_name_vide_invalide(self):
        serializer = RegisterSerializer(data={
            "email": "test@njila.cm",
            "password": "Pass1234!",
            "name": "   ",
            "surname": "Dupont",
        })
        self.assertFalse(serializer.is_valid())
        self.assertIn("name", serializer.errors)

    def test_surname_vide_invalide(self):
        serializer = RegisterSerializer(data={
            "email": "test@njila.cm",
            "password": "Pass1234!",
            "name": "Jean",
            "surname": "   ",
        })
        self.assertFalse(serializer.is_valid())
        self.assertIn("surname", serializer.errors)


# ══════════════════════════════════════════════════════════════════════════════
# TC-22 — Register : validation du mot de passe (longueur min 8)
# ══════════════════════════════════════════════════════════════════════════════
class TC22_RegisterPasswordValidation(TestCase):
    """
    Cas    : Le mot de passe doit avoir au moins 8 caractères.
    Entrée : password avec moins de 8 caractères.
    Sortie : ValidationError.
    """
    def test_password_trop_court(self):
        serializer = RegisterSerializer(data={
            "email": "test@njila.cm",
            "password": "short",
            "name": "Jean",
            "surname": "Dupont",
        })
        self.assertFalse(serializer.is_valid())
        self.assertIn("password", serializer.errors)

    def test_password_8_caracteres_valide(self):
        serializer = RegisterSerializer(data={
            "email": "test@njila.cm",
            "password": "12345678",
            "name": "Jean",
            "surname": "Dupont",
        })
        self.assertTrue(serializer.is_valid())


# ══════════════════════════════════════════════════════════════════════════════
# TC-23 — ProfileUpdateSerializer : validation des champs optionnels
# ══════════════════════════════════════════════════════════════════════════════
class TC23_ProfileUpdateSerializerTest(TestCase):
    """
    Cas    : Test du sérialiseur de mise à jour de profil.
    """
    def test_update_partiel_valide(self):
        serializer = ProfileUpdateSerializer(data={
            "name": "NouveauPrenom",
        })
        self.assertTrue(serializer.is_valid())

    def test_name_vide_invalide(self):
        serializer = ProfileUpdateSerializer(data={
            "name": "   ",
        })
        self.assertFalse(serializer.is_valid())
        self.assertIn("name", serializer.errors)

    def test_surname_vide_invalide(self):
        serializer = ProfileUpdateSerializer(data={
            "surname": "   ",
        })
        self.assertFalse(serializer.is_valid())
        self.assertIn("surname", serializer.errors)


# ══════════════════════════════════════════════════════════════════════════════
# TC-24 — PhotoUpdateSerializer : validation URL HTTPS
# ══════════════════════════════════════════════════════════════════════════════
class TC24_PhotoUpdateSerializerTest(TestCase):
    """
    Cas    : L'URL de la photo doit utiliser HTTPS.
    """
    def test_url_https_valide(self):
        serializer = PhotoUpdateSerializer(data={
            "photo_url": "https://cdn.njila.cm/photo.jpg"
        })
        self.assertTrue(serializer.is_valid())

    def test_url_http_invalide(self):
        serializer = PhotoUpdateSerializer(data={
            "photo_url": "http://cdn.njila.cm/photo.jpg"
        })
        self.assertFalse(serializer.is_valid())
        self.assertIn("photo_url", serializer.errors)


# ══════════════════════════════════════════════════════════════════════════════
# TC-25 — ResetPasswordSerializer : validation mot de passe
# ══════════════════════════════════════════════════════════════════════════════
class TC25_ResetPasswordSerializerTest(TestCase):
    """
    Cas    : Le nouveau mot de passe doit avoir au moins 8 caractères.
    """
    def test_new_password_trop_court(self):
        serializer = ResetPasswordSerializer(data={
            "token": "valid_token",
            "new_password": "short",
        })
        self.assertFalse(serializer.is_valid())
        self.assertIn("new_password", serializer.errors)

    def test_new_password_valide(self):
        serializer = ResetPasswordSerializer(data={
            "token": "valid_token",
            "new_password": "LongPassword123!",
        })
        self.assertTrue(serializer.is_valid())


# ══════════════════════════════════════════════════════════════════════════════
# TC-26 — AuthenticatedUser : méthodes et propriétés
# ══════════════════════════════════════════════════════════════════════════════
class TC26_AuthenticatedUserTest(TestCase):
    """
    Cas    : Test de la classe AuthenticatedUser (auth_middleware).
    """
    def test_authenticated_user_creation(self):
        from authentication.services.jwt_service import TokenPayload
        payload = TokenPayload(
            user_id="123",
            role=Role.ADMINISTRATEUR,
            session_id="session_123",
            filiale_id="filiale_1",
            agence_id="agence_1",
        )
        user = AuthenticatedUser(payload)
        self.assertEqual(user.id, "123")
        self.assertEqual(user.role, Role.ADMINISTRATEUR)
        self.assertEqual(user.session_id, "session_123")
        self.assertEqual(user.filiale_id, "filiale_1")
        self.assertEqual(user.agence_id, "agence_1")
        self.assertTrue(user.is_authenticated)
        self.assertFalse(user.is_anonymous)

    def test_has_role_method(self):
        from authentication.services.jwt_service import TokenPayload
        payload = TokenPayload(
            user_id="123",
            role=Role.MANAGER_GLOBAL,
            session_id="session_123",
        )
        user = AuthenticatedUser(payload)
        self.assertTrue(user.has_role(Role.MANAGER_GLOBAL))
        self.assertTrue(user.has_role(Role.MANAGER_GLOBAL, Role.ADMINISTRATEUR))
        self.assertFalse(user.has_role(Role.ADMINISTRATEUR))


# ══════════════════════════════════════════════════════════════════════════════
# TC-27 — Permission classes RBAC
# ══════════════════════════════════════════════════════════════════════════════
class TC27_PermissionClassesTest(TestCase):
    """
    Cas    : Test des classes de permission RBAC.
    """
    def test_is_administrateur(self):
        from authentication.middleware.auth_middleware import IsAdministrateur
        from authentication.services.jwt_service import TokenPayload

        admin_user = AuthenticatedUser(TokenPayload(
            user_id="1", role=Role.ADMINISTRATEUR, session_id="s1"
        ))
        manager_user = AuthenticatedUser(TokenPayload(
            user_id="2", role=Role.MANAGER_GLOBAL, session_id="s2"
        ))

        request_admin = MagicMock()
        request_admin.user = admin_user
        request_manager = MagicMock()
        request_manager.user = manager_user

        perm = IsAdministrateur()
        self.assertTrue(perm.has_permission(request_admin, None))
        self.assertFalse(perm.has_permission(request_manager, None))

    def test_is_manager_global(self):
        from authentication.middleware.auth_middleware import IsManagerGlobal

        admin_user = AuthenticatedUser(TokenPayload(
            user_id="1", role=Role.ADMINISTRATEUR, session_id="s1"
        ))
        manager_user = AuthenticatedUser(TokenPayload(
            user_id="2", role=Role.MANAGER_GLOBAL, session_id="s2"
        ))
        local_user = AuthenticatedUser(TokenPayload(
            user_id="3", role=Role.MANAGER_LOCAL, session_id="s3"
        ))

        request_admin = MagicMock()
        request_admin.user = admin_user
        request_manager = MagicMock()
        request_manager.user = manager_user
        request_local = MagicMock()
        request_local.user = local_user

        perm = IsManagerGlobal()
        self.assertTrue(perm.has_permission(request_admin, None))
        self.assertTrue(perm.has_permission(request_manager, None))
        self.assertFalse(perm.has_permission(request_local, None))

    def test_is_manager_local(self):
        from authentication.middleware.auth_middleware import IsManagerLocal

        admin_user = AuthenticatedUser(TokenPayload(
            user_id="1", role=Role.ADMINISTRATEUR, session_id="s1"
        ))
        manager_global = AuthenticatedUser(TokenPayload(
            user_id="2", role=Role.MANAGER_GLOBAL, session_id="s2"
        ))
        manager_local = AuthenticatedUser(TokenPayload(
            user_id="3", role=Role.MANAGER_LOCAL, session_id="s3"
        ))
        guichetier = AuthenticatedUser(TokenPayload(
            user_id="4", role=Role.GUICHETIER, session_id="s4"
        ))

        perm = IsManagerLocal()
        request = MagicMock()
        for user in [admin_user, manager_global, manager_local]:
            request.user = user
            self.assertTrue(perm.has_permission(request, None))
        request.user = guichetier
        self.assertFalse(perm.has_permission(request, None))

    def test_is_guichetier(self):
        from authentication.middleware.auth_middleware import IsGuichetier

        guichetier = AuthenticatedUser(TokenPayload(
            user_id="1", role=Role.GUICHETIER, session_id="s1"
        ))
        manager = AuthenticatedUser(TokenPayload(
            user_id="2", role=Role.MANAGER_LOCAL, session_id="s2"
        ))

        request_guichetier = MagicMock()
        request_guichetier.user = guichetier
        request_manager = MagicMock()
        request_manager.user = manager

        perm = IsGuichetier()
        self.assertTrue(perm.has_permission(request_guichetier, None))
        self.assertFalse(perm.has_permission(request_manager, None))

    def test_is_internal_service(self):
        from authentication.middleware.auth_middleware import IsInternalService
        from django.conf import settings

        request_valid = MagicMock()
        request_valid.META = {"HTTP_X_INTERNAL_TOKEN": getattr(settings, "INTERNAL_SERVICE_TOKEN", "")}
        request_invalid = MagicMock()
        request_invalid.META = {"HTTP_X_INTERNAL_TOKEN": "wrong_token"}

        perm = IsInternalService()
        if getattr(settings, "INTERNAL_SERVICE_TOKEN", ""):
            self.assertTrue(perm.has_permission(request_valid, None))
        self.assertFalse(perm.has_permission(request_invalid, None))


# ══════════════════════════════════════════════════════════════════════════════
# TC-28 — NjilaJWTAuthentication : extraction et validation
# ══════════════════════════════════════════════════════════════════════════════
class TC28_NjilaJWTAuthenticationTest(TestCase):
    """
    Cas    : Test de l'authentification JWT.
    """
    def setUp(self):
        self.auth = NjilaJWTAuthentication()
        self.auth._cache = MagicMock()
        self.auth._cache.is_blacklisted.return_value = False
        self.auth._cache.session_exists.return_value = True

    def test_extract_token_from_header(self):
        request = MagicMock()
        request.META = {"HTTP_AUTHORIZATION": "Bearer valid_token_123"}
        token = self.auth.extract_token(request)
        self.assertEqual(token, "valid_token_123")

    def test_extract_token_no_header(self):
        request = MagicMock()
        request.META = {}
        token = self.auth.extract_token(request)
        self.assertIsNone(token)

    def test_extract_token_invalid_format(self):
        request = MagicMock()
        request.META = {"HTTP_AUTHORIZATION": "Basic token"}
        token = self.auth.extract_token(request)
        self.assertIsNone(token)

    def test_authenticate_header(self):
        header = self.auth.authenticate_header(None)
        self.assertEqual(header, 'Bearer realm="NJILA"')


# ══════════════════════════════════════════════════════════════════════════════
# TC-29 — JwtTokenService : méthodes utilitaires
# ══════════════════════════════════════════════════════════════════════════════
class TC29_JwtTokenServiceUtilsTest(TestCase):
    """
    Cas    : Test des méthodes utilitaires du JWT service.
    """
    def setUp(self):
        self.jwt = JwtTokenService()
        self.payload = JwtTokenService().decode.__self__.__class__

    def test_decode_unverified(self):
        from authentication.services.jwt_service import TokenPayload
        payload = TokenPayload(
            user_id="test_user",
            role=Role.VOYAGEUR,
            session_id="session_123",
        )
        token = self.jwt.generate(payload)
        decoded = self.jwt.decode_unverified(token)
        self.assertIsNotNone(decoded)
        self.assertEqual(decoded.get("sub"), "test_user")

    def test_get_jti(self):
        from authentication.services.jwt_service import TokenPayload
        payload = TokenPayload(
            user_id="test_user",
            role=Role.VOYAGEUR,
            session_id="session_123",
        )
        token = self.jwt.generate(payload)
        jti = self.jwt.get_jti(token)
        self.assertIsNotNone(jti)
        self.assertIsInstance(jti, str)

    def test_get_expiry_timestamp(self):
        from authentication.services.jwt_service import TokenPayload
        payload = TokenPayload(
            user_id="test_user",
            role=Role.VOYAGEUR,
            session_id="session_123",
        )
        token = self.jwt.generate(payload)
        exp = self.jwt.get_expiry_timestamp(token)
        self.assertIsNotNone(exp)
        self.assertIsInstance(exp, int)


# ══════════════════════════════════════════════════════════════════════════════
# TC-30 — AuthRepository : méthodes CRUD utilisateurs
# ══════════════════════════════════════════════════════════════════════════════
class TC30_AuthRepositoryUserMethods(TestCase):
    """
    Cas    : Test des méthodes de repository pour les utilisateurs.
    """
    def setUp(self):
        self.repo = AuthRepository()
        self.user = make_voyageur("repo@njila.cm")

    def test_find_user_by_email(self):
        found = self.repo.find_user_by_email("repo@njila.cm")
        self.assertIsNotNone(found)
        self.assertEqual(found.email, "repo@njila.cm")

    def test_find_user_by_email_not_exists(self):
        found = self.repo.find_user_by_email("notexists@njila.cm")
        self.assertIsNone(found)

    def test_find_user_by_id(self):
        found = self.repo.find_user_by_id(str(self.user.id))
        self.assertIsNotNone(found)
        self.assertEqual(found.id, self.user.id)

    def test_find_user_by_id_not_exists(self):
        found = self.repo.find_user_by_id(str(uuid.uuid4()))
        self.assertIsNone(found)

    def test_exists_by_email(self):
        self.assertTrue(self.repo.exists_by_email("repo@njila.cm"))
        self.assertFalse(self.repo.exists_by_email("notexists@njila.cm"))

    def test_update_last_login(self):
        old_date = self.user.last_login_at
        self.repo.update_last_login(self.user)
        self.user.refresh_from_db()
        self.assertIsNotNone(self.user.last_login_at)
        if old_date:
            self.assertGreater(self.user.last_login_at, old_date)

    def test_delete_user(self):
        user_id = self.user.id
        self.repo.delete_user(str(user_id))
        self.assertFalse(NjilaUser.objects.filter(id=user_id).exists())


# ══════════════════════════════════════════════════════════════════════════════
# TC-31 — AuthRepository : gestion des sessions
# ══════════════════════════════════════════════════════════════════════════════
class TC31_AuthRepositorySessionMethods(TestCase):
    """
    Cas    : Test des méthodes de repository pour les sessions.
    """
    def setUp(self):
        self.repo = AuthRepository()
        self.user = make_voyageur("session@njila.cm")
        self.session = AuthSession.objects.create(
            session_id=uuid.uuid4(),
            user=self.user,
            access_token="acc_token",
            refresh_token="ref_token",
            expires_at=timezone.now() + timedelta(days=7),
            is_active=True,
        )

    def test_save_session(self):
        new_session = AuthSession(
            session_id=uuid.uuid4(),
            user=self.user,
            access_token="new_acc",
            refresh_token="new_ref",
            expires_at=timezone.now() + timedelta(days=7),
            is_active=True,
        )
        self.repo.save_session(new_session)
        self.assertTrue(AuthSession.objects.filter(session_id=new_session.session_id).exists())

    def test_find_session_active(self):
        found = self.repo.find_session(str(self.session.session_id))
        self.assertIsNotNone(found)
        self.assertEqual(found.session_id, self.session.session_id)

    def test_find_session_inactive(self):
        self.session.is_active = False
        self.session.save()
        found = self.repo.find_session(str(self.session.session_id))
        self.assertIsNone(found)

    def test_invalidate_session(self):
        self.repo.invalidate_session(str(self.session.session_id))
        self.session.refresh_from_db()
        self.assertFalse(self.session.is_active)

    def test_invalidate_all_user_sessions(self):
        session2 = AuthSession.objects.create(
            session_id=uuid.uuid4(),
            user=self.user,
            access_token="acc2",
            refresh_token="ref2",
            expires_at=timezone.now() + timedelta(days=7),
            is_active=True,
        )
        self.repo.invalidate_all(str(self.user.id))
        self.session.refresh_from_db()
        session2.refresh_from_db()
        self.assertFalse(self.session.is_active)
        self.assertFalse(session2.is_active)


# ══════════════════════════════════════════════════════════════════════════════
# TC-32 — NjilaUser : méthodes métier
# ══════════════════════════════════════════════════════════════════════════════
class TC32_NjilaUserModelMethods(TestCase):
    """
    Cas    : Test des méthodes métier du modèle NjilaUser.
    """
    def setUp(self):
        self.user = make_voyageur("model@njila.cm")

    def test_full_name(self):
        self.user.name = "Jean"
        self.user.surname = "Dupont"
        self.assertEqual(self.user.full_name, "Jean Dupont")

    def test_full_name_only_name(self):
        self.user.name = "Jean"
        self.user.surname = ""
        self.assertEqual(self.user.full_name, "Jean")

    def test_full_name_only_surname(self):
        self.user.name = ""
        self.user.surname = "Dupont"
        self.assertEqual(self.user.full_name, "Dupont")

    def test_full_name_fallback_email(self):
        self.user.name = ""
        self.user.surname = ""
        self.assertEqual(self.user.full_name, self.user.email)

    def test_activate(self):
        self.user.is_active = False
        self.user.is_verified = False
        self.user.deactivation_reason = "SOME_REASON"
        self.user.activate()
        self.assertTrue(self.user.is_active)
        self.assertTrue(self.user.is_verified)
        self.assertIsNone(self.user.deactivation_reason)

    def test_deactivate(self):
        self.user.deactivate(DeactivationReason.ADMIN_SUSPENDED)
        self.assertFalse(self.user.is_active)
        self.assertEqual(self.user.deactivation_reason, DeactivationReason.ADMIN_SUSPENDED)

    def test_is_locked(self):
        self.user.locked_until = timezone.now() + timedelta(minutes=15)
        self.assertTrue(self.user.is_locked())

    def test_is_not_locked(self):
        self.user.locked_until = None
        self.assertFalse(self.user.is_locked())
        self.user.locked_until = timezone.now() - timedelta(minutes=15)
        self.assertFalse(self.user.is_locked())

    def test_increment_failed_attempts(self):
        self.user.increment_failed_attempts()
        self.assertEqual(self.user.failed_attempts, 1)

    def test_increment_failed_attempts_locks_after_5(self):
        for _ in range(5):
            self.user.increment_failed_attempts()
        self.assertEqual(self.user.failed_attempts, 5)
        self.assertIsNotNone(self.user.locked_until)

    def test_reset_failed_attempts(self):
        self.user.failed_attempts = 5
        self.user.locked_until = timezone.now() + timedelta(minutes=15)
        self.user.reset_failed_attempts()
        self.assertEqual(self.user.failed_attempts, 0)
        self.assertIsNone(self.user.locked_until)

    def test_is_linked_to_agence(self):
        self.user.role = Role.GUICHETIER
        self.assertTrue(self.user.is_linked_to_agence())
        self.user.role = Role.VOYAGEUR
        self.assertFalse(self.user.is_linked_to_agence())

    def test_get_inactive_message_subscription_expired(self):
        self.user.deactivation_reason = DeactivationReason.SUBSCRIPTION_EXPIRED
        msg = self.user.get_inactive_message()
        self.assertIn("abonnement", msg.lower())
        self.assertIn("manager", msg.lower())

    def test_get_inactive_message_admin_suspended(self):
        self.user.deactivation_reason = DeactivationReason.ADMIN_SUSPENDED
        msg = self.user.get_inactive_message()
        self.assertIn("désactivé", msg.lower())


# ══════════════════════════════════════════════════════════════════════════════
# TC-33 — AuthSession : méthodes
# ══════════════════════════════════════════════════════════════════════════════
class TC33_AuthSessionModelMethods(TestCase):
    """
    Cas    : Test des méthodes du modèle AuthSession.
    """
    def setUp(self):
        self.user = make_voyageur("session_model@njila.cm")
        self.session = AuthSession.objects.create(
            session_id=uuid.uuid4(),
            user=self.user,
            access_token="acc",
            refresh_token="ref",
            expires_at=timezone.now() + timedelta(days=7),
            is_active=True,
        )

    def test_is_expired_future(self):
        self.assertFalse(self.session.is_expired())

    def test_is_expired_past(self):
        self.session.expires_at = timezone.now() - timedelta(days=1)
        self.assertTrue(self.session.is_expired())

    def test_invalidate(self):
        self.session.invalidate()
        self.assertFalse(self.session.is_active)


# ══════════════════════════════════════════════════════════════════════════════
# TC-34 — PasswordResetToken : validation
# ══════════════════════════════════════════════════════════════════════════════
class TC34_PasswordResetTokenModelTest(TestCase):
    """
    Cas    : Test du modèle PasswordResetToken.
    """
    def setUp(self):
        self.user = make_voyageur("reset_model@njila.cm")
        self.token = PasswordResetToken.objects.create(
            user=self.user,
            token="valid_token_123",
            expires_at=timezone.now() + timedelta(hours=1),
            used=False,
        )

    def test_is_valid_true(self):
        self.assertTrue(self.token.is_valid())

    def test_is_valid_used_false(self):
        self.token.used = True
        self.assertFalse(self.token.is_valid())

    def test_is_valid_expired_false(self):
        self.token.expires_at = timezone.now() - timedelta(hours=1)
        self.assertFalse(self.token.is_valid())


# ══════════════════════════════════════════════════════════════════════════════
# TC-35 — set_account_status : gestion des erreurs
# ══════════════════════════════════════════════════════════════════════════════
class TC35_SetAccountStatusErrorHandling(TestCase):
    """
    Cas    : Gestion des erreurs pour set_account_status.
    """
    def setUp(self):
        self.svc = make_service()

    def test_set_account_status_user_not_found(self):
        with self.assertRaises(ValueError):
            self.svc.set_account_status(str(uuid.uuid4()), False)

    def test_set_account_status_reactivate(self):
        user = make_staff(
            email="status@njila.cm",
            role=Role.GUICHETIER,
            is_active=False,
            deactivation_reason=DeactivationReason.ADMIN_SUSPENDED,
        )
        self.svc.set_account_status(str(user.id), True)
        user.refresh_from_db()
        self.assertTrue(user.is_active)
        self.assertIsNone(user.deactivation_reason)


# ══════════════════════════════════════════════════════════════════════════════
# TC-36 — get_me : utilisateur inexistant
# ══════════════════════════════════════════════════════════════════════════════
class TC36_GetMeUserNotFound(TestCase):
    """
    Cas    : Récupération d'un utilisateur inexistant.
    """
    def setUp(self):
        self.svc = make_service()

    def test_get_me_not_found(self):
        user = self.svc.get_me(str(uuid.uuid4()))
        self.assertIsNone(user)


# ══════════════════════════════════════════════════════════════════════════════
# ══════════════════════════════════════════════════════════════════════════════
# TC-38 — Consumer : routing keys inconnues
# ══════════════════════════════════════════════════════════════════════════════
class TC38_ConsumerUnknownRoutingKey(TestCase):
    """
    Cas    : Message avec routing key non gérée.
    """
    @patch("authentication.events.consumer.RedisSessionCache")
    def test_unknown_routing_key_logged(self, MockCache):
        MockCache.return_value = MagicMock()
        consumer = EventConsumer()
        ch = MagicMock()
        method = MagicMock()
        method.routing_key = "unknown.key"
        properties = MagicMock()
        properties.headers = {}
        body = b'{"test": "data"}'
        
        consumer._dispatch(ch, method, properties, body)
        # Vérifier que basic_ack a été appelé malgré la clé inconnue
        ch.basic_ack.assert_called_once()


# ══════════════════════════════════════════════════════════════════════════════
# TC-39 — Login : email inexistant
# ══════════════════════════════════════════════════════════════════════════════
class TC39_LoginEmailNotFound(TestCase):
    """
    Cas    : Login avec email non existant.
    """
    def setUp(self):
        self.svc = make_service()

    def test_login_email_not_found(self):
        with self.assertRaises(InvalidCredentialsError):
            self.svc.login(LoginCommand("notexists@njila.cm", "Pass1234!"))


# ══════════════════════════════════════════════════════════════════════════════
# TC-40 — Consumer : création compte auth depuis événement staff.created
# ══════════════════════════════════════════════════════════════════════════════
class TC40_ConsumerCreateAuthAccount(TestCase):
    """
    Cas    : Création d'un compte auth depuis un événement staff.created.
    """
    def setUp(self):
        self.consumer = EventConsumer()
        self.agence_id = str(uuid.uuid4())
        self.filiale_id = str(uuid.uuid4())

    @patch("authentication.events.consumer.RedisSessionCache")
    def test_create_auth_account_from_event(self, MockCache):
        MockCache.return_value = MagicMock()
        data = {
            "userId": str(uuid.uuid4()),
            "email": "staff_created@njila.cm",
            "role": Role.GUICHETIER,
            "passwordTemp": "TempPass123!",
            "name": "Staff",
            "surname": "Created",
            "phone": "691234567",
            "adresse": "Yaoundé",
            "photoUrl": "https://cdn.njila.cm/staff.jpg",
            "filialeId": self.filiale_id,
            "agenceId": self.agence_id,
        }
        self.consumer._create_auth_account(data)
        user = NjilaUser.objects.filter(email="staff_created@njila.cm").first()
        self.assertIsNotNone(user)
        self.assertEqual(user.role, Role.GUICHETIER)
        self.assertEqual(user.name, "Staff")
        self.assertEqual(user.surname, "Created")
        self.assertTrue(user.is_active)
        self.assertTrue(user.is_verified)
        self.assertEqual(user.created_by, "SYSTEM")

    @patch("authentication.events.consumer.RedisSessionCache")
    def test_create_auth_account_duplicate_ignored(self, MockCache):
        MockCache.return_value = MagicMock()
        data = {
            "userId": str(uuid.uuid4()),
            "email": "staff_created_dup@njila.cm",
            "role": Role.GUICHETIER,
            "passwordTemp": "TempPass123!",
            "name": "Staff",
            "surname": "Created",
        }
        self.consumer._create_auth_account(data)
        self.consumer._create_auth_account(data)
        count = NjilaUser.objects.filter(email="staff_created_dup@njila.cm").count()
        self.assertEqual(count, 1)
