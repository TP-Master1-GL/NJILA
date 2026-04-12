package com.njila.njila_user_service.service;

import com.njila.njila_user_service.entity.AgentFiliale;
import com.njila.njila_user_service.entity.UserProfile;
import com.njila.njila_user_service.enums.Role;
import com.njila.njila_user_service.exception.ForbiddenException;
import com.njila.njila_user_service.middleware.JwtClaims;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Component
public class RoleManager {

    // ==================== RÈGLES GÉNÉRALES ====================

    public void assertCanReadProfile(JwtClaims caller, UUID targetUserId) {
        if (caller == null) throw new ForbiddenException("Authentification requise.");
        if (caller.getRole() == Role.ADMINISTRATEUR) return;
        if (caller.getUserId().equals(targetUserId)) return;
        if (isManager(caller.getRole())) return;
        throw new ForbiddenException("Accès interdit : vous n'êtes pas autorisé à consulter ce profil.");
    }

    public void assertCanUpdateProfile(JwtClaims caller, UUID targetUserId) {
        if (caller == null) throw new ForbiddenException("Authentification requise.");
        if (caller.getUserId().equals(targetUserId)) return;
        throw new ForbiddenException("Vous ne pouvez modifier que votre propre profil.");
    }

    public void assertCanDeleteProfile(JwtClaims caller) {
        if (caller == null || caller.getRole() != Role.ADMINISTRATEUR) {
            throw new ForbiddenException("Seul un administrateur peut supprimer un profil.");
        }
    }

    // ==================== RÈGLES ADMIN ====================

    public void assertIsAdmin(JwtClaims caller) {
        if (caller == null || caller.getRole() != Role.ADMINISTRATEUR) {
            throw new ForbiddenException("Accès réservé aux administrateurs.");
        }
    }

    public void assertCanListUsers(JwtClaims caller) {
        assertIsAdmin(caller);
    }

    // ==================== RÈGLES POUR MANAGER GLOBAL ====================

    public void assertCanCreateStaffByManagerGlobal(JwtClaims caller) {
        if (caller == null) throw new ForbiddenException("Authentification requise.");
        if (caller.getRole() != Role.MANAGER_GLOBAL && caller.getRole() != Role.ADMINISTRATEUR) {
            throw new ForbiddenException("Seul un ManagerGlobal ou Admin peut créer du staff.");
        }
    }

    public void assertManagerGlobalCanManageAgence(JwtClaims caller, UUID targetAgenceId) {
        if (caller == null) throw new ForbiddenException("Authentification requise.");

        if (caller.getRole() == Role.ADMINISTRATEUR) return;

        if (caller.getRole() == Role.MANAGER_GLOBAL) {
            if (caller.getAgenceId() == null) {
                throw new ForbiddenException("ManagerGlobal sans agence associée.");
            }
            if (!caller.getAgenceId().equals(targetAgenceId)) {
                throw new ForbiddenException("Vous ne pouvez gérer que votre propre agence.");
            }
            return;
        }

        throw new ForbiddenException("Seul un ManagerGlobal ou Admin peut gérer une agence.");
    }

    public void assertCanViewStaffByAgence(JwtClaims caller, UUID agenceId) {
        assertManagerGlobalCanManageAgence(caller, agenceId);
    }

    // ==================== RÈGLES POUR MANAGER LOCAL ====================

    public void assertCanCreateEmployeByManagerLocal(JwtClaims caller) {
        if (caller == null) throw new ForbiddenException("Authentification requise.");
        if (caller.getRole() != Role.MANAGER_LOCAL && caller.getRole() != Role.MANAGER_GLOBAL) {
            throw new ForbiddenException("Seul un ManagerLocal ou ManagerGlobal peut créer des employés.");
        }
    }

    public void assertManagerLocalCanManageFiliale(JwtClaims caller, UUID targetFilialeId) {
        if (caller == null) throw new ForbiddenException("Authentification requise.");

        if (caller.getRole() == Role.ADMINISTRATEUR) return;
        if (caller.getRole() == Role.MANAGER_GLOBAL) return;

        if (caller.getRole() == Role.MANAGER_LOCAL) {
            if (caller.getFilialeId() == null) {
                throw new ForbiddenException("ManagerLocal sans filiale associée.");
            }
            if (!caller.getFilialeId().equals(targetFilialeId)) {
                throw new ForbiddenException("Vous ne pouvez gérer que votre propre filiale.");
            }
            return;
        }

        throw new ForbiddenException("Vous n'êtes pas autorisé à gérer cette filiale.");
    }

    public void assertCanViewEmployesByFiliale(JwtClaims caller, UUID filialeId) {
        assertManagerLocalCanManageFiliale(caller, filialeId);
    }

    // ==================== RÈGLES POUR SUPPRESSION ====================

    public void assertCanDeleteUser(JwtClaims caller, UserProfile target) {
        if (caller == null) throw new ForbiddenException("Authentification requise.");

        if (caller.getRole() == Role.ADMINISTRATEUR) return;

        // Récupérer agenceId et filialeId via cast conditionnel
        UUID targetAgenceId = (target instanceof AgentFiliale)
                ? ((AgentFiliale) target).getAgenceId() : null;
        UUID targetFilialeId = (target instanceof AgentFiliale)
                ? ((AgentFiliale) target).getFilialeId() : null;

        if (caller.getRole() == Role.MANAGER_GLOBAL) {
            if (target.getRole() == Role.MANAGER_GLOBAL) {
                throw new ForbiddenException("Un ManagerGlobal ne peut pas supprimer un autre ManagerGlobal.");
            }
            if (targetAgenceId == null || !targetAgenceId.equals(caller.getAgenceId())) {
                throw new ForbiddenException("Vous ne pouvez supprimer que les staff de votre agence.");
            }
            return;
        }

        if (caller.getRole() == Role.MANAGER_LOCAL) {
            if (target.getRole() == Role.MANAGER_LOCAL || target.getRole() == Role.MANAGER_GLOBAL) {
                throw new ForbiddenException("Un ManagerLocal ne peut pas supprimer un manager.");
            }
            if (targetFilialeId == null || !targetFilialeId.equals(caller.getFilialeId())) {
                throw new ForbiddenException("Vous ne pouvez supprimer que les employés de votre filiale.");
            }
            return;
        }

        throw new ForbiddenException("Vous n'êtes pas autorisé à supprimer cet utilisateur.");
    }

    // ==================== RÈGLES POUR AVIS ====================

    public void assertCanSubmitAvis(JwtClaims caller) {
        if (caller == null) throw new ForbiddenException("Authentification requise.");
        if (caller.getRole() != Role.VOYAGEUR) {
            throw new ForbiddenException("Seuls les voyageurs peuvent soumettre un avis.");
        }
    }

    public void assertCanDeleteAvis(JwtClaims caller, UUID auteurId) {
        if (caller == null) throw new ForbiddenException("Authentification requise.");
        if (caller.getRole() == Role.ADMINISTRATEUR) return;
        if (caller.getUserId().equals(auteurId)) return;
        throw new ForbiddenException("Vous ne pouvez supprimer que vos propres avis.");
    }

    // ==================== HELPERS ====================

    private boolean isManager(Role role) {
        return role == Role.MANAGER_LOCAL || role == Role.MANAGER_GLOBAL;
    }
}