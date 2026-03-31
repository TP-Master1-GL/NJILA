package com.njila.njila_user_service.service;

import com.njila.njila_user_service.enums.Role;
import com.njila.njila_user_service.exception.ForbiddenException;
import com.njila.njila_user_service.middleware.JwtClaims;
import org.junit.jupiter.api.*;

import java.util.UUID;

import static org.assertj.core.api.Assertions.*;

@DisplayName("RoleManager — Règles d'autorisation")
class RoleManagerTest {

    private final RoleManager roleManager = new RoleManager();
    private static final UUID USER_ID  = UUID.randomUUID();
    private static final UUID OTHER_ID = UUID.randomUUID();

    private JwtClaims caller(Role role, UUID userId) {
        return JwtClaims.builder().userId(userId).role(role).build();
    }

    // ── Lecture profil ────────────────────────────────────────────────────

    @Test @DisplayName("Voyageur peut lire son propre profil")
    void readOwnProfile() {
        assertThatNoException().isThrownBy(() ->
            roleManager.assertCanReadProfile(caller(Role.VOYAGEUR, USER_ID), USER_ID));
    }

    @Test @DisplayName("Voyageur ne peut pas lire le profil d'un autre")
    void cannotReadOtherProfile() {
        assertThatThrownBy(() ->
            roleManager.assertCanReadProfile(caller(Role.VOYAGEUR, USER_ID), OTHER_ID))
            .isInstanceOf(ForbiddenException.class);
    }

    @Test @DisplayName("Admin lit n'importe quel profil")
    void adminReadsAny() {
        assertThatNoException().isThrownBy(() ->
            roleManager.assertCanReadProfile(caller(Role.ADMINISTRATEUR, OTHER_ID), USER_ID));
    }

    @Test @DisplayName("Manager local lit n'importe quel profil")
    void managerReadsAny() {
        assertThatNoException().isThrownBy(() ->
            roleManager.assertCanReadProfile(caller(Role.MANAGER_LOCAL, OTHER_ID), USER_ID));
    }

    // ── Mise à jour ───────────────────────────────────────────────────────

    @Test @DisplayName("Utilisateur peut modifier son propre profil")
    void updateOwnProfile() {
        assertThatNoException().isThrownBy(() ->
            roleManager.assertCanUpdateProfile(caller(Role.VOYAGEUR, USER_ID), USER_ID));
    }

    @Test @DisplayName("Utilisateur ne peut pas modifier le profil d'un autre")
    void cannotUpdateOtherProfile() {
        assertThatThrownBy(() ->
            roleManager.assertCanUpdateProfile(caller(Role.VOYAGEUR, USER_ID), OTHER_ID))
            .isInstanceOf(ForbiddenException.class);
    }

    @Test @DisplayName("Admin peut modifier n'importe quel profil")
    void adminUpdatesAny() {
        assertThatNoException().isThrownBy(() ->
            roleManager.assertCanUpdateProfile(caller(Role.ADMINISTRATEUR, OTHER_ID), USER_ID));
    }

    // ── Suppression ───────────────────────────────────────────────────────

    @Test @DisplayName("Admin peut supprimer")
    void adminDeletes() {
        assertThatNoException().isThrownBy(() ->
            roleManager.assertCanDeleteProfile(caller(Role.ADMINISTRATEUR, OTHER_ID)));
    }

    @Test @DisplayName("Voyageur ne peut pas supprimer")
    void voyageurCannotDelete() {
        assertThatThrownBy(() ->
            roleManager.assertCanDeleteProfile(caller(Role.VOYAGEUR, USER_ID)))
            .isInstanceOf(ForbiddenException.class);
    }

    @Test @DisplayName("Manager local ne peut pas supprimer")
    void managerCannotDelete() {
        assertThatThrownBy(() ->
            roleManager.assertCanDeleteProfile(caller(Role.MANAGER_LOCAL, OTHER_ID)))
            .isInstanceOf(ForbiddenException.class);
    }

    // ── Création staff ────────────────────────────────────────────────────

    @Test @DisplayName("Manager local peut créer du staff")
    void managerLocalCreatesStaff() {
        assertThatNoException().isThrownBy(() ->
            roleManager.assertCanCreateStaff(caller(Role.MANAGER_LOCAL, OTHER_ID)));
    }

    @Test @DisplayName("Manager global peut créer du staff")
    void managerGlobalCreatesStaff() {
        assertThatNoException().isThrownBy(() ->
            roleManager.assertCanCreateStaff(caller(Role.MANAGER_GLOBAL, OTHER_ID)));
    }

    @Test @DisplayName("Voyageur ne peut pas créer du staff")
    void voyageurCannotCreateStaff() {
        assertThatThrownBy(() ->
            roleManager.assertCanCreateStaff(caller(Role.VOYAGEUR, USER_ID)))
            .isInstanceOf(ForbiddenException.class);
    }

    // ── Avis ──────────────────────────────────────────────────────────────

    @Test @DisplayName("Voyageur peut soumettre un avis")
    void voyageurSubmitsAvis() {
        assertThatNoException().isThrownBy(() ->
            roleManager.assertCanSubmitAvis(caller(Role.VOYAGEUR, USER_ID)));
    }

    @Test @DisplayName("Guichetier ne peut pas soumettre un avis")
    void guichetierCannotSubmitAvis() {
        assertThatThrownBy(() ->
            roleManager.assertCanSubmitAvis(caller(Role.GUICHETIER, USER_ID)))
            .isInstanceOf(ForbiddenException.class);
    }

    @Test @DisplayName("Auteur peut supprimer son avis")
    void authorDeletesOwnAvis() {
        assertThatNoException().isThrownBy(() ->
            roleManager.assertCanDeleteAvis(caller(Role.VOYAGEUR, USER_ID), USER_ID));
    }

    @Test @DisplayName("Admin peut supprimer n'importe quel avis")
    void adminDeletesAnyAvis() {
        assertThatNoException().isThrownBy(() ->
            roleManager.assertCanDeleteAvis(caller(Role.ADMINISTRATEUR, OTHER_ID), USER_ID));
    }

    @Test @DisplayName("Utilisateur ne peut pas supprimer l'avis d'un autre")
    void cannotDeleteOtherAvis() {
        assertThatThrownBy(() ->
            roleManager.assertCanDeleteAvis(caller(Role.VOYAGEUR, OTHER_ID), USER_ID))
            .isInstanceOf(ForbiddenException.class);
    }

    // ── Null caller ───────────────────────────────────────────────────────

    @Test @DisplayName("caller null → ForbiddenException partout")
    void nullCallerForbidden() {
        assertThatThrownBy(() -> roleManager.assertCanReadProfile(null, USER_ID))
            .isInstanceOf(ForbiddenException.class);
        assertThatThrownBy(() -> roleManager.assertCanUpdateProfile(null, USER_ID))
            .isInstanceOf(ForbiddenException.class);
        assertThatThrownBy(() -> roleManager.assertCanDeleteProfile(null))
            .isInstanceOf(ForbiddenException.class);
        assertThatThrownBy(() -> roleManager.assertCanCreateStaff(null))
            .isInstanceOf(ForbiddenException.class);
        assertThatThrownBy(() -> roleManager.assertCanSubmitAvis(null))
            .isInstanceOf(ForbiddenException.class);
    }
}