
import logging
import secrets
import uuid
from datetime import timedelta
from typing import List, Optional

from django.db import transaction
from django.utils import timezone

from authentication.models import (
    AuthSession,
    DeactivationReason,
    NjilaUser,
    PasswordResetToken,
    ROLES_LINKED_TO_AGENCE,
)

logger = logging.getLogger(__name__)


class AuthRepository:

    def find_user_by_email(self, email: str) -> Optional[NjilaUser]:
        try:
            return NjilaUser.objects.get(email=email.lower().strip())
        except NjilaUser.DoesNotExist:
            return None

    def find_user_by_id(self, user_id: str) -> Optional[NjilaUser]:
        try:
            return NjilaUser.objects.get(id=user_id)
        except (NjilaUser.DoesNotExist, Exception):
            return None

    def exists_by_email(self, email: str) -> bool:
        return NjilaUser.objects.filter(email=email.lower().strip()).exists()

    @transaction.atomic
    def save_user(self, user: NjilaUser) -> NjilaUser:
        user.save()
        logger.debug("[REPO] Utilisateur sauvegardé : %s [%s]", user.email, user.role)
        return user

    def delete_user(self, user_id: str):
        NjilaUser.objects.filter(id=user_id).delete()

    def update_last_login(self, user: NjilaUser):
        user.last_login_at = timezone.now()
        user.save(update_fields=["last_login_at", "updated_at"])

    def set_user_status(
        self,
        user_id:   str,
        is_active: bool,
        reason:    str = DeactivationReason.ADMIN_SUSPENDED,
    ) -> Optional[NjilaUser]:
        try:
            user = NjilaUser.objects.get(id=user_id)
            user.is_active = is_active
            user.deactivation_reason = None if is_active else reason
            user.save(update_fields=["is_active", "deactivation_reason", "updated_at"])
            return user
        except NjilaUser.DoesNotExist:
            return None

   
    @transaction.atomic
    def deactivate_agence_users(self, agence_id: str) -> List[str]:
        users = NjilaUser.objects.filter(
            agence_id  = agence_id,
            role__in   = list(ROLES_LINKED_TO_AGENCE),
            is_active  = True,       # ne re-désactiver que les actifs
        )
        user_ids = list(users.values_list("id", flat=True))

        updated = users.update(
            is_active           = False,
            deactivation_reason = DeactivationReason.SUBSCRIPTION_EXPIRED,
        )
        logger.info(
            "[REPO] Abonnement expiré | agence=%s → %d utilisateurs désactivés",
            agence_id, updated,
        )
        return [str(uid) for uid in user_ids]

    @transaction.atomic
    def reactivate_agence_users(self, agence_id: str) -> List[str]:
        users = NjilaUser.objects.filter(
            agence_id           = agence_id,
            role__in            = list(ROLES_LINKED_TO_AGENCE),
            is_active           = False,
            deactivation_reason = DeactivationReason.SUBSCRIPTION_EXPIRED,
        )
        user_ids = list(users.values_list("id", flat=True))

        updated = users.update(
            is_active           = True,
            deactivation_reason = None,
        )
        logger.info(
            "[REPO] Abonnement renouvelé | agence=%s → %d utilisateurs réactivés",
            agence_id, updated,
        )
        return [str(uid) for uid in user_ids]

    def find_active_sessions_by_user_ids(self, user_ids: List[str]) -> List[AuthSession]:
        return list(
            AuthSession.objects.filter(
                user_id__in = user_ids,
                is_active   = True,
            ).select_related("user")
        )

    @transaction.atomic
    def invalidate_sessions_by_user_ids(self, user_ids: List[str]) -> int:
        count = AuthSession.objects.filter(
            user_id__in = user_ids,
            is_active   = True,
        ).update(is_active=False)
        logger.debug("[REPO] %d sessions invalidées pour %d users", count, len(user_ids))
        return count

    def save_session(self, session: AuthSession) -> AuthSession:
        session.save()
        return session

    def find_session(self, session_id: str) -> Optional[AuthSession]:
        try:
            return AuthSession.objects.get(session_id=session_id, is_active=True)
        except AuthSession.DoesNotExist:
            return None

    def invalidate_session(self, session_id: str):
        AuthSession.objects.filter(session_id=session_id).update(is_active=False)

    def invalidate_all(self, user_id: str):
        AuthSession.objects.filter(user_id=user_id, is_active=True).update(is_active=False)

    def create_reset_token(self, user: NjilaUser) -> PasswordResetToken:
        PasswordResetToken.objects.filter(user=user, used=False).update(used=True)
        token = PasswordResetToken.objects.create(
            user       = user,
            token      = secrets.token_urlsafe(48),
            expires_at = timezone.now() + timedelta(hours=1),
        )
        return token

    def find_reset_token(self, token_str: str) -> Optional[PasswordResetToken]:
        try:
            return PasswordResetToken.objects.get(token=token_str, used=False)
        except PasswordResetToken.DoesNotExist:
            return None

    def consume_reset_token(self, token: PasswordResetToken):
        token.used = True
        token.save(update_fields=["used"])