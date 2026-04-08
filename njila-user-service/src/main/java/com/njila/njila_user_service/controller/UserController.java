package com.njila.njila_user_service.controller;

import com.njila.njila_user_service.dto.request.AvisRequest;
import com.njila.njila_user_service.dto.request.CreateStaffRequest;
import com.njila.njila_user_service.dto.request.UpdateProfileRequest;
import com.njila.njila_user_service.dto.response.ApiResponse;
import com.njila.njila_user_service.dto.response.AvisResponse;
import com.njila.njila_user_service.dto.response.UserProfileResponse;
import com.njila.njila_user_service.enums.Role;
import com.njila.njila_user_service.middleware.JwtClaims;
import com.njila.njila_user_service.middleware.JwtMiddleware;
import com.njila.njila_user_service.service.RoleManager;
import com.njila.njila_user_service.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.headers.Header;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;


@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "User Management", description = "Gestion des profils utilisateurs, staff et avis")
@SecurityRequirement(name = "bearerAuth")
public class UserController {

    private final UserService userService;
    private final RoleManager roleManager;  // AJOUTÉ

    // ── Health ─────────────────────────────────────────────────────────────

    @GetMapping("/users/health")
    @Operation(
        summary = "Health check",
        description = "Vérifie l'état du service (utilisé par Eureka et les probes Kubernetes)",
        security = {}  // Pas d'authentification requise
    )
    @ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "200",
            description = "Service opérationnel",
            content = @Content(examples = @ExampleObject(value = "{\"success\":true,\"data\":\"UP\",\"message\":\"njila-user-service\"}"))
        )
    })
    public ResponseEntity<ApiResponse<String>> health() {
        return ResponseEntity.ok(ApiResponse.ok("UP", "njila-user-service"));
    }

    // ── Profil ─────────────────────────────────────────────────────────────

    @GetMapping("/users/{userId}")
    @Operation(
        summary = "Récupérer un profil utilisateur",
        description = """
            Retourne les informations d'un profil utilisateur.
            
            **Permissions requises :**
            - L'utilisateur lui-même
            - MANAGER_LOCAL / MANAGER_GLOBAL
            """
    )
    @ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "200",
            description = "Profil trouvé"
        ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "401",
            description = "JWT absent ou invalide"
        ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "403",
            description = "Non autorisé à consulter ce profil"
        ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "404",
            description = "Profil introuvable"
        )
    })
    public ResponseEntity<ApiResponse<UserProfileResponse>> getProfile(
        @Parameter(description = "UUID de l'utilisateur", example = "123e4567-e89b-12d3-a456-426614174000")
        @PathVariable UUID userId,
        HttpServletRequest request
    ) {
        JwtClaims caller = getClaims(request);
        return ResponseEntity.ok(ApiResponse.ok(userService.getProfile(userId, caller)));
    }

    @PutMapping("/users/{userId}")
    @Operation(
        summary = "Mettre à jour un profil",
        description = """
            Met à jour les informations d'un profil utilisateur.
            
            **Permissions requises :**
            - L'utilisateur lui-même
            """
    )
    @ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "200",
            description = "Profil mis à jour avec succès"
        ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "401",
            description = "JWT absent"
        ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "403",
            description = "Non propriétaire ou non admin"
        ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "404",
            description = "Profil introuvable"
        )
    })
    public ResponseEntity<ApiResponse<UserProfileResponse>> updateProfile(
        @Parameter(description = "UUID de l'utilisateur", example = "123e4567-e89b-12d3-a456-426614174000")
        @PathVariable UUID userId,
        @Valid @RequestBody UpdateProfileRequest body,
        HttpServletRequest request
    ) {
        JwtClaims caller = getClaims(request);
        UserProfileResponse updated = userService.updateProfile(userId, body, caller);
        return ResponseEntity.ok(ApiResponse.ok(updated, "Profil mis à jour avec succès."));
    }

    @DeleteMapping("/users/{userId}")
    @Operation(
        summary = "Supprimer un profil",
        description = "Supprime définitivement un profil utilisateur. **Réservé aux administrateurs.**"
    )
    @ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "204",
            description = "Profil supprimé avec succès",
            headers = @Header(name = "Content-Type", description = "No content")
        ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "401",
            description = "JWT absent"
        ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "403",
            description = "Non administrateur"
        ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "404",
            description = "Profil introuvable"
        )
    })
    public ResponseEntity<Void> deleteProfile(
        @Parameter(description = "UUID de l'utilisateur", example = "123e4567-e89b-12d3-a456-426614174000")
        @PathVariable UUID userId,
        HttpServletRequest request
    ) {
        JwtClaims caller = getClaims(request);
        userService.deleteProfile(userId, caller);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/users")
    @Operation(
        summary = "Lister tous les utilisateurs",
        description = """
            Retourne la liste de tous les utilisateurs.
            
            **Permissions requises :**
            - MANAGER_LOCAL / MANAGER_GLOBAL
            - ADMINISTRATEUR
            """
    )
    public ResponseEntity<ApiResponse<List<UserProfileResponse>>> listUsers(
        HttpServletRequest request
    ) {
        JwtClaims caller = getClaims(request);
        return ResponseEntity.ok(ApiResponse.ok(userService.listUsers(caller)));
    }

    // ── Staff ──────────────────────────────────────────────────────────────

    @PostMapping("/users/guichetiers")
    @Operation(
        summary = "Créer un guichetier",
        description = """
            Crée un nouveau compte guichetier.
            Le mot de passe temporaire sera "0000" et devra être modifié à la première connexion.
            
            **Permissions requises :**
            - MANAGER_LOCAL (doit être associé à la filiale)
            - MANAGER_GLOBAL
            """
    )
    public ResponseEntity<ApiResponse<Void>> createGuichetier(
        @Valid @RequestBody CreateStaffRequest body,
        HttpServletRequest request
    ) {
        body.setRole(Role.GUICHETIER);
        userService.createStaff(body, getClaims(request));
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(ApiResponse.<Void>builder()
                .success(true)
                .message("Compte guichetier en cours de création.")
                .build());
    }

    @PostMapping("/users/chauffeurs")
    @Operation(
        summary = "Créer un chauffeur",
        description = """
            Crée un nouveau compte chauffeur.
            Le mot de passe temporaire sera "0000" et devra être modifié à la première connexion.
            
            **Permissions requises :**
            - MANAGER_LOCAL (doit être associé à la filiale)
            - MANAGER_GLOBAL
            """
    )
    public ResponseEntity<ApiResponse<Void>> createChauffeur(
        @Valid @RequestBody CreateStaffRequest body,
        HttpServletRequest request
    ) {
        body.setRole(Role.CHAUFFEUR);
        userService.createStaff(body, getClaims(request));
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(ApiResponse.<Void>builder()
                .success(true)
                .message("Compte chauffeur en cours de création.")
                .build());
    }

    @PostMapping("/users/managers")
    @Operation(
        summary = "Créer un manager",
        description = """
            Crée un nouveau compte manager (LOCAL ou GLOBAL).
            Le mot de passe temporaire sera "0000" et devra être modifié à la première connexion.
            
            **Permissions requises :**
            - MANAGER_GLOBAL (peut créer MANAGER_LOCAL)
            """
    )
    public ResponseEntity<ApiResponse<Void>> createManager(
        @Valid @RequestBody CreateStaffRequest body,
        HttpServletRequest request
    ) {
        userService.createStaff(body, getClaims(request));
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(ApiResponse.<Void>builder()
                .success(true)
                .message("Compte manager en cours de création.")
                .build());
    }

    // ── Avis ───────────────────────────────────────────────────────────────

    @PostMapping("/users/{userId}/avis")
    @Operation(
        summary = "Soumettre un avis",
        description = """
            Permet à un voyageur de soumettre un avis sur une agence.
            
            **Permissions requises :**
            - VOYAGEUR uniquement
            - Un seul avis par voyageur par agence
            """
    )
    public ResponseEntity<ApiResponse<AvisResponse>> submitAvis(
        @Parameter(description = "UUID de l'utilisateur", example = "123e4567-e89b-12d3-a456-426614174000")
        @PathVariable UUID userId,
        @Valid @RequestBody AvisRequest body,
        HttpServletRequest request
    ) {
        JwtClaims caller = getClaims(request);
        AvisResponse avis = userService.submitAvis(userId, body, caller);
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(ApiResponse.ok(avis, "Avis soumis avec succès."));
    }

    @GetMapping("/users/{userId}/avis")
    @Operation(
        summary = "Récupérer les avis d'un utilisateur",
        description = "Retourne tous les avis soumis par un utilisateur."
    )
    public ResponseEntity<ApiResponse<List<AvisResponse>>> getUserAvis(
        @Parameter(description = "UUID de l'utilisateur", example = "123e4567-e89b-12d3-a456-426614174000")
        @PathVariable UUID userId,
        HttpServletRequest request
    ) {
        JwtClaims caller = getClaims(request);
        return ResponseEntity.ok(ApiResponse.ok(userService.getUserAvis(userId, caller)));
    }

    @DeleteMapping("/users/{userId}/avis/{avisId}")
    @Operation(
        summary = "Supprimer un avis",
        description = """
            Supprime un avis existant.
            
            **Permissions requises :**
            - L'auteur de l'avis
            - ADMINISTRATEUR
            """
    )
    public ResponseEntity<Void> deleteAvis(
        @Parameter(description = "UUID de l'utilisateur", example = "123e4567-e89b-12d3-a456-426614174000")
        @PathVariable UUID userId,
        @Parameter(description = "UUID de l'avis", example = "223e4567-e89b-12d3-a456-426614174000")
        @PathVariable UUID avisId,
        HttpServletRequest request
    ) {
        JwtClaims caller = getClaims(request);
        userService.deleteAvis(userId, avisId, caller);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/avis/agence/{agenceId}")
    @Operation(
        summary = "Avis publics d'une agence",
        description = "Retourne les avis visibles d'une agence (paginé). Endpoint public - aucun JWT requis.",
        security = {}
    )
    public ResponseEntity<ApiResponse<Page<AvisResponse>>> getAgenceAvis(
        @Parameter(description = "UUID de l'agence", example = "123e4567-e89b-12d3-a456-426614174000")
        @PathVariable UUID agenceId,
        @Parameter(description = "Numéro de page (0-indexed)", example = "0")
        @RequestParam(defaultValue = "0") int page,
        @Parameter(description = "Taille de la page", example = "10")
        @RequestParam(defaultValue = "10") int size
    ) {
        return ResponseEntity.ok(ApiResponse.ok(
            userService.getAgenceAvis(agenceId, PageRequest.of(page, size))
        ));
    }

    @GetMapping("/avis/agence/{agenceId}/stats")
    @Operation(
        summary = "Statistiques des avis d'une agence",
        description = "Retourne la note moyenne d'une agence. Endpoint public - aucun JWT requis.",
        security = {}
    )
    public ResponseEntity<ApiResponse<Map<String, Object>>> getAgenceStats(
        @Parameter(description = "UUID de l'agence", example = "123e4567-e89b-12d3-a456-426614174000")
        @PathVariable UUID agenceId
    ) {
        double moyenne = userService.getNoteMoyenne(agenceId);
        return ResponseEntity.ok(ApiResponse.ok(
            Map.of("agenceId", agenceId, "noteMoyenne", moyenne)
        ));
    }

    // ==================== NOUVEAUX ENDPOINTS POUR MANAGERGLOBAL/MANAGERLOCAL ====================

    @GetMapping("/agences/{agenceId}/staff")
    @Operation(
        summary = "Lister tous les staff d'une agence",
        description = """
            Retourne la liste de tous les staff (ManagerLocal, Guichetier, Chauffeur) d'une agence.
            
            **Permissions requises :**
            - MANAGER_GLOBAL (uniquement pour son agence)
            """
    )
    public ResponseEntity<ApiResponse<List<UserProfileResponse>>> listStaffByAgence(
        @Parameter(description = "UUID de l'agence", example = "123e4567-e89b-12d3-a456-426614174000")
        @PathVariable UUID agenceId,
        HttpServletRequest request
    ) {
        JwtClaims caller = getClaims(request);
        return ResponseEntity.ok(ApiResponse.ok(userService.listStaffByAgence(agenceId, caller)));
    }

    @GetMapping("/filiales/{filialeId}/staff")
    @Operation(
        summary = "Lister tous les staff d'une filiale",
        description = """
            Retourne la liste de tous les staff (Guichetier, Chauffeur) d'une filiale.
            
            **Permissions requises :**
            - MANAGER_LOCAL (uniquement pour sa filiale)
            - MANAGER_GLOBAL (si la filiale appartient à son agence)
            """
    )
    public ResponseEntity<ApiResponse<List<UserProfileResponse>>> listStaffByFiliale(
        @Parameter(description = "UUID de la filiale", example = "123e4567-e89b-12d3-a456-426614174000")
        @PathVariable UUID filialeId,
        HttpServletRequest request
    ) {
        JwtClaims caller = getClaims(request);
        return ResponseEntity.ok(ApiResponse.ok(userService.listStaffByFiliale(filialeId, caller)));
    }

    @DeleteMapping("/staff/{staffId}")
    @Operation(
        summary = "Supprimer un compte staff",
        description = """
            Supprime un compte staff (Guichetier, Chauffeur, ManagerLocal, ManagerGlobal).
            
            **Permissions requises :**
            - MANAGER_LOCAL : peut supprimer Guichetier et Chauffeur de SA filiale uniquement
            - MANAGER_GLOBAL : peut supprimer tout staff de SON agence
            """
    )
    public ResponseEntity<Void> deleteStaff(
        @Parameter(description = "UUID du staff à supprimer", example = "123e4567-e89b-12d3-a456-426614174000")
        @PathVariable UUID staffId,
        HttpServletRequest request
    ) {
        JwtClaims caller = getClaims(request);
        userService.deleteStaff(staffId, caller);
        return ResponseEntity.noContent().build();
    }

    // ── Helper ─────────────────────────────────────────────────────────────

    private JwtClaims getClaims(HttpServletRequest request) {
        return (JwtClaims) request.getAttribute(JwtMiddleware.CLAIMS_ATTR);
    }
}