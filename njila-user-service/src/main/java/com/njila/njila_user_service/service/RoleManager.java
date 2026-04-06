package com.njila.njila_user_service.service;

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

    private boolean isManager(Role role) {
        return role == Role.MANAGER_LOCAL || role == Role.MANAGER_GLOBAL;
    }
}