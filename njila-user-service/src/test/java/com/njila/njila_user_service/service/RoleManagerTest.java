package com.njila.njila_user_service.service;

import com.njila.njila_user_service.enums.Role;
import com.njila.njila_user_service.exception.ForbiddenException;
import com.njila.njila_user_service.middleware.JwtClaims;
import org.junit.jupiter.api.*;

import java.util.UUID;
import static org.assertj.core.api.Assertions.*;

@DisplayName("RoleManager — Regles d autorisation")
class RoleManagerTest {

    private final RoleManager roleManager = new RoleManager();
    private static final UUID USER_ID  = UUID.randomUUID();
    private static final UUID OTHER_ID = UUID.randomUUID();

    private JwtClaims caller(Role role, UUID userId) {
        return JwtClaims.builder().userId(userId).role(role).build();
    }

    // ── assertCanReadProfile ──────────────────────────────────────────────────

    @Test @DisplayName("Voyageur lit son propre profil")
    void read_ownProfile_ok() {
        assertThatNoException().isThrownBy(() -> roleManager.assertCanReadProfile(caller(Role.VOYAGEUR, USER_ID), USER_ID));
    }

    @Test @DisplayName("Voyageur ne peut pas lire le profil d un autre")
    void read_otherProfile_forbidden() {
        assertThatThrownBy(() -> roleManager.assertCanReadProfile(caller(Role.VOYAGEUR, USER_ID), OTHER_ID))
            .isInstanceOf(ForbiddenException.class);
    }

    @Test @DisplayName("Admin lit n importe quel profil")
    void read_admin_ok() {
        assertThatNoException().isThrownBy(() -> roleManager.assertCanReadProfile(caller(Role.ADMINISTRATEUR, OTHER_ID), USER_ID));
    }

    @Test @DisplayName("Manager local lit n importe quel profil")
    void read_managerLocal_ok() {
        assertThatNoException().isThrownBy(() -> roleManager.assertCanReadProfile(caller(Role.MANAGER_LOCAL, OTHER_ID), USER_ID));
    }

    @Test @DisplayName("Manager global lit n importe quel profil")
    void read_managerGlobal_ok() {
        assertThatNoException().isThrownBy(() -> roleManager.assertCanReadProfile(caller(Role.MANAGER_GLOBAL, OTHER_ID), USER_ID));
    }

    @Test @DisplayName("caller null -> ForbiddenException read")
    void read_nullCaller_forbidden() {
        assertThatThrownBy(() -> roleManager.assertCanReadProfile(null, USER_ID))
            .isInstanceOf(ForbiddenException.class);
    }

    // ── assertCanUpdateProfile ────────────────────────────────────────────────

    @Test @DisplayName("Utilisateur modifie son propre profil")
    void update_ownProfile_ok() {
        assertThatNoException().isThrownBy(() -> roleManager.assertCanUpdateProfile(caller(Role.VOYAGEUR, USER_ID), USER_ID));
    }

    @Test @DisplayName("Utilisateur ne peut pas modifier le profil d un autre")
    void update_otherProfile_forbidden() {
        assertThatThrownBy(() -> roleManager.assertCanUpdateProfile(caller(Role.VOYAGEUR, USER_ID), OTHER_ID))
            .isInstanceOf(ForbiddenException.class);
    }

    @Test @DisplayName("Admin modifie n importe quel profil")
    void update_admin_ok() {
        assertThatNoException().isThrownBy(() -> roleManager.assertCanUpdateProfile(caller(Role.ADMINISTRATEUR, OTHER_ID), USER_ID));
    }

    @Test @DisplayName("caller null -> ForbiddenException update")
    void update_nullCaller_forbidden() {
        assertThatThrownBy(() -> roleManager.assertCanUpdateProfile(null, USER_ID))
            .isInstanceOf(ForbiddenException.class);
    }

    // ── assertCanDeleteProfile ────────────────────────────────────────────────

    @Test @DisplayName("Admin peut supprimer")
    void delete_admin_ok() {
        assertThatNoException().isThrownBy(() -> roleManager.assertCanDeleteProfile(caller(Role.ADMINISTRATEUR, OTHER_ID)));
    }

    @Test @DisplayName("Voyageur ne peut pas supprimer")
    void delete_voyageur_forbidden() {
        assertThatThrownBy(() -> roleManager.assertCanDeleteProfile(caller(Role.VOYAGEUR, USER_ID)))
            .isInstanceOf(ForbiddenException.class);
    }

    @Test @DisplayName("Manager ne peut pas supprimer")
    void delete_manager_forbidden() {
        assertThatThrownBy(() -> roleManager.assertCanDeleteProfile(caller(Role.MANAGER_LOCAL, OTHER_ID)))
            .isInstanceOf(ForbiddenException.class);
    }

    @Test @DisplayName("caller null -> ForbiddenException delete")
    void delete_nullCaller_forbidden() {
        assertThatThrownBy(() -> roleManager.assertCanDeleteProfile(null))
            .isInstanceOf(ForbiddenException.class);
    }

    // ── assertCanCreateStaff ──────────────────────────────────────────────────

    @Test @DisplayName("Manager local peut creer du staff")
    void createStaff_managerLocal_ok() {
        assertThatNoException().isThrownBy(() -> roleManager.assertCanCreateStaff(caller(Role.MANAGER_LOCAL, OTHER_ID)));
    }

    @Test @DisplayName("Manager global peut creer du staff")
    void createStaff_managerGlobal_ok() {
        assertThatNoException().isThrownBy(() -> roleManager.assertCanCreateStaff(caller(Role.MANAGER_GLOBAL, OTHER_ID)));
    }

    @Test @DisplayName("Admin peut creer du staff")
    void createStaff_admin_ok() {
        assertThatNoException().isThrownBy(() -> roleManager.assertCanCreateStaff(caller(Role.ADMINISTRATEUR, OTHER_ID)));
    }

    @Test @DisplayName("Voyageur ne peut pas creer du staff")
    void createStaff_voyageur_forbidden() {
        assertThatThrownBy(() -> roleManager.assertCanCreateStaff(caller(Role.VOYAGEUR, USER_ID)))
            .isInstanceOf(ForbiddenException.class);
    }

    @Test @DisplayName("Guichetier ne peut pas creer du staff")
    void createStaff_guichetier_forbidden() {
        assertThatThrownBy(() -> roleManager.assertCanCreateStaff(caller(Role.GUICHETIER, USER_ID)))
            .isInstanceOf(ForbiddenException.class);
    }

    @Test @DisplayName("caller null -> ForbiddenException createStaff")
    void createStaff_nullCaller_forbidden() {
        assertThatThrownBy(() -> roleManager.assertCanCreateStaff(null))
            .isInstanceOf(ForbiddenException.class);
    }

    // ── assertCanSubmitAvis ───────────────────────────────────────────────────

    @Test @DisplayName("Voyageur peut soumettre un avis")
    void submitAvis_voyageur_ok() {
        assertThatNoException().isThrownBy(() -> roleManager.assertCanSubmitAvis(caller(Role.VOYAGEUR, USER_ID)));
    }

    @Test @DisplayName("Guichetier ne peut pas soumettre un avis")
    void submitAvis_guichetier_forbidden() {
        assertThatThrownBy(() -> roleManager.assertCanSubmitAvis(caller(Role.GUICHETIER, USER_ID)))
            .isInstanceOf(ForbiddenException.class);
    }

    @Test @DisplayName("Manager ne peut pas soumettre un avis")
    void submitAvis_manager_forbidden() {
        assertThatThrownBy(() -> roleManager.assertCanSubmitAvis(caller(Role.MANAGER_LOCAL, USER_ID)))
            .isInstanceOf(ForbiddenException.class);
    }

    @Test @DisplayName("Admin ne peut pas soumettre un avis")
    void submitAvis_admin_forbidden() {
        assertThatThrownBy(() -> roleManager.assertCanSubmitAvis(caller(Role.ADMINISTRATEUR, USER_ID)))
            .isInstanceOf(ForbiddenException.class);
    }

    @Test @DisplayName("caller null -> ForbiddenException submitAvis")
    void submitAvis_nullCaller_forbidden() {
        assertThatThrownBy(() -> roleManager.assertCanSubmitAvis(null))
            .isInstanceOf(ForbiddenException.class);
    }

    // ── assertCanDeleteAvis ───────────────────────────────────────────────────

    @Test @DisplayName("Auteur supprime son propre avis")
    void deleteAvis_author_ok() {
        assertThatNoException().isThrownBy(() -> roleManager.assertCanDeleteAvis(caller(Role.VOYAGEUR, USER_ID), USER_ID));
    }

    @Test @DisplayName("Admin supprime n importe quel avis")
    void deleteAvis_admin_ok() {
        assertThatNoException().isThrownBy(() -> roleManager.assertCanDeleteAvis(caller(Role.ADMINISTRATEUR, OTHER_ID), USER_ID));
    }

    @Test @DisplayName("Autre voyageur ne peut pas supprimer l avis d un tiers")
    void deleteAvis_otherUser_forbidden() {
        assertThatThrownBy(() -> roleManager.assertCanDeleteAvis(caller(Role.VOYAGEUR, OTHER_ID), USER_ID))
            .isInstanceOf(ForbiddenException.class);
    }

    @Test @DisplayName("caller null -> ForbiddenException deleteAvis")
    void deleteAvis_nullCaller_forbidden() {
        assertThatThrownBy(() -> roleManager.assertCanDeleteAvis(null, USER_ID))
            .isInstanceOf(ForbiddenException.class);
    }

    // ── assertIsAdmin ─────────────────────────────────────────────────────────

    @Test @DisplayName("assertIsAdmin: admin passe")
    void isAdmin_ok() {
        assertThatNoException().isThrownBy(() -> roleManager.assertIsAdmin(caller(Role.ADMINISTRATEUR, OTHER_ID)));
    }

    @Test @DisplayName("assertIsAdmin: non-admin echoue")
    void isAdmin_forbidden() {
        assertThatThrownBy(() -> roleManager.assertIsAdmin(caller(Role.VOYAGEUR, USER_ID)))
            .isInstanceOf(ForbiddenException.class);
    }

    @Test @DisplayName("assertIsAdmin: null echoue")
    void isAdmin_null_forbidden() {
        assertThatThrownBy(() -> roleManager.assertIsAdmin(null))
            .isInstanceOf(ForbiddenException.class);
    }

    // ── assertCanListUsers ────────────────────────────────────────────────────

    @Test @DisplayName("assertCanListUsers: admin passe")
    void listUsers_admin_ok() {
        assertThatNoException().isThrownBy(() -> roleManager.assertCanListUsers(caller(Role.ADMINISTRATEUR, OTHER_ID)));
    }

    @Test @DisplayName("assertCanListUsers: manager local passe")
    void listUsers_managerLocal_ok() {
        assertThatNoException().isThrownBy(() -> roleManager.assertCanListUsers(caller(Role.MANAGER_LOCAL, OTHER_ID)));
    }

    @Test @DisplayName("assertCanListUsers: voyageur interdit")
    void listUsers_voyageur_forbidden() {
        assertThatThrownBy(() -> roleManager.assertCanListUsers(caller(Role.VOYAGEUR, USER_ID)))
            .isInstanceOf(ForbiddenException.class);
    }

    @Test @DisplayName("assertCanListUsers: null interdit")
    void listUsers_null_forbidden() {
        assertThatThrownBy(() -> roleManager.assertCanListUsers(null))
            .isInstanceOf(ForbiddenException.class);
    }
}