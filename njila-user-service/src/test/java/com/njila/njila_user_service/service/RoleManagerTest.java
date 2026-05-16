package com.njila.njila_user_service.service;

import com.njila.njila_user_service.entity.AgentFiliale;
import com.njila.njila_user_service.entity.Guichetier;
import com.njila.njila_user_service.entity.ManagerGlobal;
import com.njila.njila_user_service.entity.ManagerLocal;
import com.njila.njila_user_service.entity.UserProfile;
import com.njila.njila_user_service.enums.Role;
import com.njila.njila_user_service.exception.ForbiddenException;
import com.njila.njila_user_service.middleware.JwtClaims;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.assertThatNoException;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Tests unitaires pour {@link RoleManager}.
 * Couvre toutes les règles d'autorisation du service.
 */
class RoleManagerTest {

    private RoleManager roleManager;

    private UUID userId;
    private UUID agenceId;
    private UUID filialeId;

    @BeforeEach
    void setUp() {
        roleManager = new RoleManager();
        userId    = UUID.randomUUID();
        agenceId  = UUID.randomUUID();
        filialeId = UUID.randomUUID();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────────

    private JwtClaims claims(Role role, UUID uid) {
        JwtClaims c = mock(JwtClaims.class);
        when(c.getRole()).thenReturn(role);
        when(c.getUserId()).thenReturn(uid);
        return c;
    }

    private JwtClaims claims(Role role, UUID uid, UUID agence, UUID filiale) {
        JwtClaims c = claims(role, uid);
        when(c.getAgenceId()).thenReturn(agence);
        when(c.getFilialeId()).thenReturn(filiale);
        return c;
    }

    private Guichetier guichetier(UUID agence, UUID filiale) {
        Guichetier g = mock(Guichetier.class);
        when(g.getRole()).thenReturn(Role.GUICHETIER);
        when(g.getAgenceId()).thenReturn(agence);
        when(g.getFilialeId()).thenReturn(filiale);
        return g;
    }

    private ManagerGlobal managerGlobal(UUID agence) {
        ManagerGlobal mg = mock(ManagerGlobal.class);
        when(mg.getRole()).thenReturn(Role.MANAGER_GLOBAL);
        when(mg.getAgenceId()).thenReturn(agence);
        // ManagerGlobal n'a pas de méthode getFilialeId()
        return mg;
    }

    private ManagerLocal managerLocal(UUID agence, UUID filiale) {
        ManagerLocal ml = mock(ManagerLocal.class);
        when(ml.getRole()).thenReturn(Role.MANAGER_LOCAL);
        when(ml.getAgenceId()).thenReturn(agence);
        when(ml.getFilialeId()).thenReturn(filiale);
        return ml;
    }

    // =========================================================================
    // assertCanReadProfile
    // =========================================================================

    @Nested
    @DisplayName("assertCanReadProfile")
    class AssertCanReadProfile {

        @Test
        @DisplayName("null caller → ForbiddenException")
        void nullCaller_throws() {
            assertThatThrownBy(() -> roleManager.assertCanReadProfile(null, userId))
                    .isInstanceOf(ForbiddenException.class);
        }

        @Test
        @DisplayName("ADMINISTRATEUR peut lire n'importe quel profil")
        void admin_canRead() {
            JwtClaims caller = claims(Role.ADMINISTRATEUR, UUID.randomUUID());
            assertThatNoException().isThrownBy(() -> roleManager.assertCanReadProfile(caller, userId));
        }

        @Test
        @DisplayName("Utilisateur peut lire son propre profil")
        void selfRead_allowed() {
            JwtClaims caller = claims(Role.VOYAGEUR, userId);
            assertThatNoException().isThrownBy(() -> roleManager.assertCanReadProfile(caller, userId));
        }

        @Test
        @DisplayName("MANAGER_LOCAL peut lire n'importe quel profil")
        void managerLocal_canRead() {
            JwtClaims caller = claims(Role.MANAGER_LOCAL, UUID.randomUUID());
            assertThatNoException().isThrownBy(() -> roleManager.assertCanReadProfile(caller, userId));
        }

        @Test
        @DisplayName("MANAGER_GLOBAL peut lire n'importe quel profil")
        void managerGlobal_canRead() {
            JwtClaims caller = claims(Role.MANAGER_GLOBAL, UUID.randomUUID());
            assertThatNoException().isThrownBy(() -> roleManager.assertCanReadProfile(caller, userId));
        }

        @Test
        @DisplayName("VOYAGEUR ne peut pas lire le profil d'un autre utilisateur")
        void voyageur_cannotReadOther() {
            JwtClaims caller = claims(Role.VOYAGEUR, UUID.randomUUID());
            assertThatThrownBy(() -> roleManager.assertCanReadProfile(caller, userId))
                    .isInstanceOf(ForbiddenException.class);
        }
    }

    // =========================================================================
    // assertCanUpdateProfile
    // =========================================================================

    @Nested
    @DisplayName("assertCanUpdateProfile")
    class AssertCanUpdateProfile {

        @Test
        @DisplayName("null caller → ForbiddenException")
        void nullCaller_throws() {
            assertThatThrownBy(() -> roleManager.assertCanUpdateProfile(null, userId))
                    .isInstanceOf(ForbiddenException.class);
        }

        @Test
        @DisplayName("Utilisateur peut modifier son propre profil")
        void selfUpdate_allowed() {
            JwtClaims caller = claims(Role.VOYAGEUR, userId);
            assertThatNoException().isThrownBy(() -> roleManager.assertCanUpdateProfile(caller, userId));
        }

        @Test
        @DisplayName("Admin ne peut pas modifier le profil d'un autre (règle : self only)")
        void admin_cannotUpdateOther() {
            JwtClaims caller = claims(Role.ADMINISTRATEUR, UUID.randomUUID());
            assertThatThrownBy(() -> roleManager.assertCanUpdateProfile(caller, userId))
                    .isInstanceOf(ForbiddenException.class);
        }

        @Test
        @DisplayName("Autre utilisateur ne peut pas modifier le profil cible")
        void otherUser_cannotUpdate() {
            JwtClaims caller = claims(Role.VOYAGEUR, UUID.randomUUID());
            assertThatThrownBy(() -> roleManager.assertCanUpdateProfile(caller, userId))
                    .isInstanceOf(ForbiddenException.class);
        }
    }

    // =========================================================================
    // assertCanDeleteProfile
    // =========================================================================

    @Nested
    @DisplayName("assertCanDeleteProfile")
    class AssertCanDeleteProfile {

        @Test
        @DisplayName("ADMINISTRATEUR peut supprimer un profil")
        void admin_canDelete() {
            JwtClaims caller = claims(Role.ADMINISTRATEUR, UUID.randomUUID());
            assertThatNoException().isThrownBy(() -> roleManager.assertCanDeleteProfile(caller));
        }

        @Test
        @DisplayName("null caller → ForbiddenException")
        void nullCaller_throws() {
            assertThatThrownBy(() -> roleManager.assertCanDeleteProfile(null))
                    .isInstanceOf(ForbiddenException.class);
        }

        @Test
        @DisplayName("Non-admin → ForbiddenException")
        void nonAdmin_throws() {
            JwtClaims caller = claims(Role.MANAGER_GLOBAL, UUID.randomUUID());
            assertThatThrownBy(() -> roleManager.assertCanDeleteProfile(caller))
                    .isInstanceOf(ForbiddenException.class);
        }
    }

    // =========================================================================
    // assertIsAdmin
    // =========================================================================

    @Nested
    @DisplayName("assertIsAdmin")
    class AssertIsAdmin {

        @Test
        @DisplayName("ADMINISTRATEUR passe")
        void admin_passes() {
            JwtClaims caller = claims(Role.ADMINISTRATEUR, UUID.randomUUID());
            assertThatNoException().isThrownBy(() -> roleManager.assertIsAdmin(caller));
        }

        @Test
        @DisplayName("null → ForbiddenException")
        void null_throws() {
            assertThatThrownBy(() -> roleManager.assertIsAdmin(null))
                    .isInstanceOf(ForbiddenException.class);
        }

        @Test
        @DisplayName("VOYAGEUR → ForbiddenException")
        void voyageur_throws() {
            JwtClaims caller = claims(Role.VOYAGEUR, UUID.randomUUID());
            assertThatThrownBy(() -> roleManager.assertIsAdmin(caller))
                    .isInstanceOf(ForbiddenException.class);
        }
    }

    // =========================================================================
    // assertCanCreateStaffByManagerGlobal
    // =========================================================================

    @Nested
    @DisplayName("assertCanCreateStaffByManagerGlobal")
    class AssertCanCreateStaffByManagerGlobal {

        @Test
        @DisplayName("MANAGER_GLOBAL peut créer du staff")
        void managerGlobal_allowed() {
            JwtClaims caller = claims(Role.MANAGER_GLOBAL, UUID.randomUUID());
            assertThatNoException().isThrownBy(
                    () -> roleManager.assertCanCreateStaffByManagerGlobal(caller));
        }

        @Test
        @DisplayName("ADMINISTRATEUR peut créer du staff")
        void admin_allowed() {
            JwtClaims caller = claims(Role.ADMINISTRATEUR, UUID.randomUUID());
            assertThatNoException().isThrownBy(
                    () -> roleManager.assertCanCreateStaffByManagerGlobal(caller));
        }

        @Test
        @DisplayName("MANAGER_LOCAL → ForbiddenException")
        void managerLocal_throws() {
            JwtClaims caller = claims(Role.MANAGER_LOCAL, UUID.randomUUID());
            assertThatThrownBy(() -> roleManager.assertCanCreateStaffByManagerGlobal(caller))
                    .isInstanceOf(ForbiddenException.class);
        }

        @Test
        @DisplayName("null caller → ForbiddenException")
        void null_throws() {
            assertThatThrownBy(() -> roleManager.assertCanCreateStaffByManagerGlobal(null))
                    .isInstanceOf(ForbiddenException.class);
        }
    }

    // =========================================================================
    // assertManagerGlobalCanManageAgence
    // =========================================================================

    @Nested
    @DisplayName("assertManagerGlobalCanManageAgence")
    class AssertManagerGlobalCanManageAgence {

        @Test
        @DisplayName("ADMINISTRATEUR peut gérer n'importe quelle agence")
        void admin_allowed() {
            JwtClaims caller = claims(Role.ADMINISTRATEUR, UUID.randomUUID());
            assertThatNoException().isThrownBy(
                    () -> roleManager.assertManagerGlobalCanManageAgence(caller, agenceId));
        }

        @Test
        @DisplayName("MANAGER_GLOBAL peut gérer sa propre agence")
        void managerGlobal_ownAgence_allowed() {
            JwtClaims caller = claims(Role.MANAGER_GLOBAL, UUID.randomUUID(), agenceId, null);
            assertThatNoException().isThrownBy(
                    () -> roleManager.assertManagerGlobalCanManageAgence(caller, agenceId));
        }

        @Test
        @DisplayName("MANAGER_GLOBAL ne peut pas gérer une autre agence")
        void managerGlobal_otherAgence_throws() {
            JwtClaims caller = claims(Role.MANAGER_GLOBAL, UUID.randomUUID(), UUID.randomUUID(), null);
            assertThatThrownBy(
                    () -> roleManager.assertManagerGlobalCanManageAgence(caller, agenceId))
                    .isInstanceOf(ForbiddenException.class);
        }

        @Test
        @DisplayName("MANAGER_GLOBAL sans agenceId → ForbiddenException")
        void managerGlobal_noAgenceId_throws() {
            JwtClaims caller = claims(Role.MANAGER_GLOBAL, UUID.randomUUID(), null, null);
            assertThatThrownBy(
                    () -> roleManager.assertManagerGlobalCanManageAgence(caller, agenceId))
                    .isInstanceOf(ForbiddenException.class);
        }

        @Test
        @DisplayName("VOYAGEUR → ForbiddenException")
        void voyageur_throws() {
            JwtClaims caller = claims(Role.VOYAGEUR, UUID.randomUUID());
            assertThatThrownBy(
                    () -> roleManager.assertManagerGlobalCanManageAgence(caller, agenceId))
                    .isInstanceOf(ForbiddenException.class);
        }
    }

    // =========================================================================
    // assertManagerLocalCanManageFiliale
    // =========================================================================

    @Nested
    @DisplayName("assertManagerLocalCanManageFiliale")
    class AssertManagerLocalCanManageFiliale {

        @Test
        @DisplayName("ADMINISTRATEUR passe toujours")
        void admin_allowed() {
            JwtClaims caller = claims(Role.ADMINISTRATEUR, UUID.randomUUID());
            assertThatNoException().isThrownBy(
                    () -> roleManager.assertManagerLocalCanManageFiliale(caller, filialeId));
        }

        @Test
        @DisplayName("MANAGER_GLOBAL passe toujours")
        void managerGlobal_allowed() {
            JwtClaims caller = claims(Role.MANAGER_GLOBAL, UUID.randomUUID(), agenceId, null);
            assertThatNoException().isThrownBy(
                    () -> roleManager.assertManagerLocalCanManageFiliale(caller, filialeId));
        }

        @Test
        @DisplayName("MANAGER_LOCAL peut gérer sa propre filiale")
        void managerLocal_ownFiliale_allowed() {
            JwtClaims caller = claims(Role.MANAGER_LOCAL, UUID.randomUUID(), agenceId, filialeId);
            assertThatNoException().isThrownBy(
                    () -> roleManager.assertManagerLocalCanManageFiliale(caller, filialeId));
        }

        @Test
        @DisplayName("MANAGER_LOCAL ne peut pas gérer une autre filiale")
        void managerLocal_otherFiliale_throws() {
            JwtClaims caller = claims(Role.MANAGER_LOCAL, UUID.randomUUID(), agenceId, UUID.randomUUID());
            assertThatThrownBy(
                    () -> roleManager.assertManagerLocalCanManageFiliale(caller, filialeId))
                    .isInstanceOf(ForbiddenException.class);
        }

        @Test
        @DisplayName("MANAGER_LOCAL sans filialeId → ForbiddenException")
        void managerLocal_noFilialeId_throws() {
            JwtClaims caller = claims(Role.MANAGER_LOCAL, UUID.randomUUID(), agenceId, null);
            assertThatThrownBy(
                    () -> roleManager.assertManagerLocalCanManageFiliale(caller, filialeId))
                    .isInstanceOf(ForbiddenException.class);
        }

        @Test
        @DisplayName("VOYAGEUR → ForbiddenException")
        void voyageur_throws() {
            JwtClaims caller = claims(Role.VOYAGEUR, UUID.randomUUID());
            assertThatThrownBy(
                    () -> roleManager.assertManagerLocalCanManageFiliale(caller, filialeId))
                    .isInstanceOf(ForbiddenException.class);
        }
    }

    // =========================================================================
    // assertCanDeleteUser
    // =========================================================================

    @Nested
    @DisplayName("assertCanDeleteUser")
    class AssertCanDeleteUser {

        @Test
        @DisplayName("ADMINISTRATEUR peut supprimer n'importe qui")
        void admin_canDeleteAnyone() {
            JwtClaims caller = claims(Role.ADMINISTRATEUR, UUID.randomUUID());
            Guichetier target = guichetier(agenceId, filialeId);
            assertThatNoException().isThrownBy(() -> roleManager.assertCanDeleteUser(caller, target));
        }

        @Test
        @DisplayName("MANAGER_GLOBAL peut supprimer un employé de son agence")
        void managerGlobal_canDeleteOwnAgenceEmployee() {
            JwtClaims caller = claims(Role.MANAGER_GLOBAL, UUID.randomUUID(), agenceId, null);
            Guichetier target = guichetier(agenceId, filialeId);
            assertThatNoException().isThrownBy(() -> roleManager.assertCanDeleteUser(caller, target));
        }

        @Test
        @DisplayName("MANAGER_GLOBAL ne peut pas supprimer un employé d'une autre agence")
        void managerGlobal_cannotDeleteOtherAgenceEmployee() {
            JwtClaims caller = claims(Role.MANAGER_GLOBAL, UUID.randomUUID(), agenceId, null);
            Guichetier target = guichetier(UUID.randomUUID(), filialeId);
            assertThatThrownBy(() -> roleManager.assertCanDeleteUser(caller, target))
                    .isInstanceOf(ForbiddenException.class);
        }

        @Test
        @DisplayName("MANAGER_GLOBAL ne peut pas supprimer un autre MANAGER_GLOBAL")
        void managerGlobal_cannotDeleteOtherManagerGlobal() {
            JwtClaims caller = claims(Role.MANAGER_GLOBAL, UUID.randomUUID(), agenceId, null);
            ManagerGlobal target = managerGlobal(agenceId);
            assertThatThrownBy(() -> roleManager.assertCanDeleteUser(caller, target))
                    .isInstanceOf(ForbiddenException.class);
        }

        @Test
        @DisplayName("MANAGER_LOCAL peut supprimer un employé de sa filiale")
        void managerLocal_canDeleteOwnFilialeEmployee() {
            JwtClaims caller = claims(Role.MANAGER_LOCAL, UUID.randomUUID(), agenceId, filialeId);
            Guichetier target = guichetier(agenceId, filialeId);
            assertThatNoException().isThrownBy(() -> roleManager.assertCanDeleteUser(caller, target));
        }

        @Test
        @DisplayName("MANAGER_LOCAL ne peut pas supprimer un employé d'une autre filiale")
        void managerLocal_cannotDeleteOtherFilialeEmployee() {
            JwtClaims caller = claims(Role.MANAGER_LOCAL, UUID.randomUUID(), agenceId, filialeId);
            Guichetier target = guichetier(agenceId, UUID.randomUUID());
            assertThatThrownBy(() -> roleManager.assertCanDeleteUser(caller, target))
                    .isInstanceOf(ForbiddenException.class);
        }

        @Test
        @DisplayName("MANAGER_LOCAL ne peut pas supprimer un MANAGER_LOCAL")
        void managerLocal_cannotDeleteManagerLocal() {
            JwtClaims caller = claims(Role.MANAGER_LOCAL, UUID.randomUUID(), agenceId, filialeId);
            ManagerLocal target = managerLocal(agenceId, filialeId);
            assertThatThrownBy(() -> roleManager.assertCanDeleteUser(caller, target))
                    .isInstanceOf(ForbiddenException.class);
        }

        @Test
        @DisplayName("MANAGER_LOCAL ne peut pas supprimer un MANAGER_GLOBAL")
        void managerLocal_cannotDeleteManagerGlobal() {
            JwtClaims caller = claims(Role.MANAGER_LOCAL, UUID.randomUUID(), agenceId, filialeId);
            ManagerGlobal target = managerGlobal(agenceId);
            assertThatThrownBy(() -> roleManager.assertCanDeleteUser(caller, target))
                    .isInstanceOf(ForbiddenException.class);
        }

        @Test
        @DisplayName("VOYAGEUR → ForbiddenException")
        void voyageur_throws() {
            JwtClaims caller = claims(Role.VOYAGEUR, UUID.randomUUID());
            Guichetier target = guichetier(agenceId, filialeId);
            assertThatThrownBy(() -> roleManager.assertCanDeleteUser(caller, target))
                    .isInstanceOf(ForbiddenException.class);
        }

        @Test
        @DisplayName("null caller → ForbiddenException")
        void null_throws() {
            Guichetier target = guichetier(agenceId, filialeId);
            assertThatThrownBy(() -> roleManager.assertCanDeleteUser(null, target))
                    .isInstanceOf(ForbiddenException.class);
        }
    }

    // =========================================================================
    // assertCanSubmitAvis
    // =========================================================================

    @Nested
    @DisplayName("assertCanSubmitAvis")
    class AssertCanSubmitAvis {

        @Test
        @DisplayName("VOYAGEUR peut soumettre un avis")
        void voyageur_allowed() {
            JwtClaims caller = claims(Role.VOYAGEUR, UUID.randomUUID());
            assertThatNoException().isThrownBy(() -> roleManager.assertCanSubmitAvis(caller));
        }

        @Test
        @DisplayName("ADMINISTRATEUR → ForbiddenException")
        void admin_throws() {
            JwtClaims caller = claims(Role.ADMINISTRATEUR, UUID.randomUUID());
            assertThatThrownBy(() -> roleManager.assertCanSubmitAvis(caller))
                    .isInstanceOf(ForbiddenException.class);
        }

        @Test
        @DisplayName("MANAGER_GLOBAL → ForbiddenException")
        void managerGlobal_throws() {
            JwtClaims caller = claims(Role.MANAGER_GLOBAL, UUID.randomUUID());
            assertThatThrownBy(() -> roleManager.assertCanSubmitAvis(caller))
                    .isInstanceOf(ForbiddenException.class);
        }

        @Test
        @DisplayName("null caller → ForbiddenException")
        void null_throws() {
            assertThatThrownBy(() -> roleManager.assertCanSubmitAvis(null))
                    .isInstanceOf(ForbiddenException.class);
        }
    }

    // =========================================================================
    // assertCanDeleteAvis
    // =========================================================================

    @Nested
    @DisplayName("assertCanDeleteAvis")
    class AssertCanDeleteAvis {

        @Test
        @DisplayName("ADMINISTRATEUR peut supprimer n'importe quel avis")
        void admin_allowed() {
            JwtClaims caller = claims(Role.ADMINISTRATEUR, UUID.randomUUID());
            assertThatNoException().isThrownBy(
                    () -> roleManager.assertCanDeleteAvis(caller, UUID.randomUUID()));
        }

        @Test
        @DisplayName("Auteur peut supprimer son propre avis")
        void auteur_canDelete() {
            JwtClaims caller = claims(Role.VOYAGEUR, userId);
            assertThatNoException().isThrownBy(
                    () -> roleManager.assertCanDeleteAvis(caller, userId));
        }

        @Test
        @DisplayName("Autre voyageur ne peut pas supprimer l'avis d'un autre")
        void otherVoyageur_throws() {
            JwtClaims caller = claims(Role.VOYAGEUR, UUID.randomUUID());
            assertThatThrownBy(() -> roleManager.assertCanDeleteAvis(caller, userId))
                    .isInstanceOf(ForbiddenException.class);
        }

        @Test
        @DisplayName("null caller → ForbiddenException")
        void null_throws() {
            assertThatThrownBy(() -> roleManager.assertCanDeleteAvis(null, userId))
                    .isInstanceOf(ForbiddenException.class);
        }
    }
}