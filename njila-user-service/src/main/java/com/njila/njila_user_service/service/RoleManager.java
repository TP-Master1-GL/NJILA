package com.njila.njila_user_service.service;

import com.njila.njila_user_service.entity.UserProfile;
import com.njila.njila_user_service.enums.Role;
import com.njila.njila_user_service.exception.ForbiddenException;
import com.njila.njila_user_service.middleware.JwtClaims;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * RoleManager — diagramme composants user-service.
 * Centralise toutes les règles d'autorisation.
 *
 * Règles issues des diagrammes de séquence :
 *   GET  profile  → propriétaire | Manager | Administrateur
 *   PUT  profile  → propriétaire | Administrateur
 *   DELETE        → Administrateur uniquement
 *   POST guichetier/chauffeur/manager → Manager local | Manager global | Admin
 *   POST avis     → Voyageur uniquement
 *   DELETE avis   → auteur | Administrateur
 */
@Component
public class RoleManager {

    public void assertCanReadProfile(JwtClaims caller, UUID targetUserId) {
        if (caller == null) {
            throw new ForbiddenException("Authentification requise.");
        }
        if (caller.getRole() == Role.ADMINISTRATEUR) return;
        if (caller.getUserId().equals(targetUserId))  return;
        if (isManager(caller.getRole()))               return;
        throw new ForbiddenException(
            "Accès interdit : vous n'êtes pas autorisé à consulter ce profil."
        );
    }

    public void assertCanUpdateProfile(JwtClaims caller, UUID targetUserId) {
        if (caller == null) throw new ForbiddenException("Authentification requise.");
        if (caller.getRole() == Role.ADMINISTRATEUR)  return;
        if (caller.getUserId().equals(targetUserId))   return;
        throw new ForbiddenException(
            "Accès interdit : vous ne pouvez modifier que votre propre profil."
        );
    }

    public void assertCanDeleteProfile(JwtClaims caller) {
        if (caller == null || caller.getRole() != Role.ADMINISTRATEUR) {
            throw new ForbiddenException(
                "Accès interdit : seul un administrateur peut supprimer un profil."
            );
        }
    }

    public void assertCanCreateStaff(JwtClaims caller) {
        if (caller == null) throw new ForbiddenException("Authentification requise.");
        if (caller.getRole() == Role.MANAGER_LOCAL
            || caller.getRole() == Role.MANAGER_GLOBAL
            || caller.getRole() == Role.ADMINISTRATEUR) return;
        throw new ForbiddenException(
            "Accès interdit : seuls les managers peuvent créer des comptes staff."
        );
    }

    public void assertCanListUsers(JwtClaims caller) {
        if (caller == null) throw new ForbiddenException("Authentification requise.");
        if (caller.getRole() == Role.ADMINISTRATEUR
            || caller.getRole() == Role.MANAGER_LOCAL
            || caller.getRole() == Role.MANAGER_GLOBAL) return;
        throw new ForbiddenException("Accès interdit.");
    }

    public void assertCanSubmitAvis(JwtClaims caller) {
        if (caller == null) throw new ForbiddenException("Authentification requise.");
        if (caller.getRole() != Role.VOYAGEUR) {
            throw new ForbiddenException(
                "Seuls les voyageurs peuvent soumettre un avis sur une agence."
            );
        }
    }

    public void assertCanDeleteAvis(JwtClaims caller, UUID auteurId) {
        if (caller == null) throw new ForbiddenException("Authentification requise.");
        if (caller.getRole() == Role.ADMINISTRATEUR) return;
        if (caller.getUserId().equals(auteurId))     return;
        throw new ForbiddenException(
            "Accès interdit : vous ne pouvez supprimer que vos propres avis."
        );
    }

    public void assertIsAdmin(JwtClaims caller) {
        if (caller == null || caller.getRole() != Role.ADMINISTRATEUR) {
            throw new ForbiddenException("Accès réservé aux administrateurs.");
        }
    }

    // ==================== NOUVELLES MÉTHODES POUR MANAGERGLOBAL/MANAGERLOCAL ====================

    /**
     * Vérifie qu'un ManagerGlobal agit bien sur SA propre agence
     */
    public void assertManagerCanManageAgence(JwtClaims caller, UUID targetAgenceId) {
        if (caller == null) {
            throw new ForbiddenException("Authentification requise.");
        }
        
        // ADMIN peut tout faire
        if (caller.getRole() == Role.ADMINISTRATEUR) {
            return;
        }
        
        // ManagerGlobal doit avoir l'agenceId dans son token
        if (caller.getRole() == Role.MANAGER_GLOBAL) {
            if (caller.getAgenceId() == null) {
                throw new ForbiddenException("ManagerGlobal sans agence associée.");
            }
            if (!caller.getAgenceId().equals(targetAgenceId)) {
                throw new ForbiddenException("Vous ne pouvez gérer que les staff de votre propre agence.");
            }
            return;
        }
        
        throw new ForbiddenException("Seul un ManagerGlobal ou Administrateur peut gérer les staff d'une agence.");
    }

    /**
     * Vérifie qu'un ManagerLocal agit bien sur SA propre filiale
     */
    public void assertManagerCanManageFiliale(JwtClaims caller, UUID targetFilialeId) {
        if (caller == null) {
            throw new ForbiddenException("Authentification requise.");
        }
        
        // ADMIN peut tout faire
        if (caller.getRole() == Role.ADMINISTRATEUR) {
            return;
        }
        
        // ManagerLocal doit avoir la filialeId dans son token
        if (caller.getRole() == Role.MANAGER_LOCAL) {
            if (caller.getFilialeId() == null) {
                throw new ForbiddenException("ManagerLocal sans filiale associée.");
            }
            if (!caller.getFilialeId().equals(targetFilialeId)) {
                throw new ForbiddenException("Vous ne pouvez gérer que les staff de votre propre filiale.");
            }
            return;
        }
        
        // ManagerGlobal peut aussi gérer une filiale (via son agence)
        if (caller.getRole() == Role.MANAGER_GLOBAL) {
            // On vérifiera plus tard que la filiale appartient à son agence
            return;
        }
        
        throw new ForbiddenException("Vous n'êtes pas autorisé à gérer ces staff.");
    }

    /**
     * Vérifie qu'un ManagerLocal ou ManagerGlobal peut supprimer un staff
     */
    public void assertCanDeleteStaff(JwtClaims caller, UserProfile targetStaff) {
        if (caller == null) {
            throw new ForbiddenException("Authentification requise.");
        }
        
        // ADMIN peut tout supprimer
        if (caller.getRole() == Role.ADMINISTRATEUR) {
            return;
        }
        
        // ManagerGlobal : vérifier que le staff est dans son agence
        if (caller.getRole() == Role.MANAGER_GLOBAL) {
            if (caller.getAgenceId() == null) {
                throw new ForbiddenException("ManagerGlobal sans agence associée.");
            }
            if (targetStaff.getAgenceId() == null || !targetStaff.getAgenceId().equals(caller.getAgenceId())) {
                throw new ForbiddenException("Vous ne pouvez supprimer que les staff de votre agence.");
            }
            return;
        }
        
        // ManagerLocal : vérifier que le staff est dans sa filiale
        if (caller.getRole() == Role.MANAGER_LOCAL) {
            if (caller.getFilialeId() == null) {
                throw new ForbiddenException("ManagerLocal sans filiale associée.");
            }
            if (targetStaff.getFilialeId() == null || !targetStaff.getFilialeId().equals(caller.getFilialeId())) {
                throw new ForbiddenException("Vous ne pouvez supprimer que les staff de votre filiale.");
            }
            // ManagerLocal ne peut pas supprimer un autre manager
            if (targetStaff.getRole() == Role.MANAGER_LOCAL || targetStaff.getRole() == Role.MANAGER_GLOBAL) {
                throw new ForbiddenException("Un ManagerLocal ne peut pas supprimer un autre manager.");
            }
            return;
        }
        
        throw new ForbiddenException("Vous n'êtes pas autorisé à supprimer ce staff.");
    }

    private boolean isManager(Role role) {
        return role == Role.MANAGER_LOCAL || role == Role.MANAGER_GLOBAL;
    }
}