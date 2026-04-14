package com.njila.njila_user_service.controller;

import com.njila.njila_user_service.dto.request.*;
import com.njila.njila_user_service.dto.response.ApiResponse;
import com.njila.njila_user_service.dto.response.AvisResponse;
import com.njila.njila_user_service.dto.response.UserProfileResponse;
import com.njila.njila_user_service.middleware.JwtClaims;
import com.njila.njila_user_service.middleware.JwtMiddleware;
import com.njila.njila_user_service.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
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

    // ── Health Check (public) ───────────────────────────────────────────────

    @GetMapping("/users/health")
    @Operation(
        summary = "Health check",
        description = "Vérifie l'état du service",
        security = {}
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

    // ──────────────────────────── PROFIL ────────────────────────────────────

    @GetMapping("/users/{userId}")
    @Operation(
        summary = "Récupérer un profil utilisateur",
        description = "Retourne les informations d'un profil utilisateur."
    )
    public ResponseEntity<ApiResponse<UserProfileResponse>> getProfile(
        @Parameter(description = "UUID de l'utilisateur")
        @PathVariable UUID userId,
        HttpServletRequest request
    ) {
        JwtClaims caller = getClaims(request);
        return ResponseEntity.ok(ApiResponse.ok(userService.getProfile(userId, caller)));
    }

    @PutMapping("/users/{userId}")
    @Operation(
        summary = "Mettre à jour un profil",
        description = "Met à jour les informations d'un profil utilisateur."
    )
    public ResponseEntity<ApiResponse<UserProfileResponse>> updateProfile(
        @PathVariable UUID userId,
        @Valid @RequestBody UpdateProfileRequest body,
        HttpServletRequest request
    ) {
        JwtClaims caller = getClaims(request);
        UserProfileResponse updated = userService.updateProfile(userId, body, caller);
        return ResponseEntity.ok(ApiResponse.ok(updated, "Profil mis à jour avec succès."));
    }

    @PatchMapping("/users/{userId}/photo")
    @Operation(
        summary = "Mettre à jour la photo de profil",
        description = "Met à jour la photo de profil d'un utilisateur."
    )
    public ResponseEntity<ApiResponse<UserProfileResponse>> updatePhoto(
        @PathVariable UUID userId,
        @Valid @RequestBody UpdatePhotoRequest body,
        HttpServletRequest request
    ) {
        JwtClaims caller = getClaims(request);
        UserProfileResponse updated = userService.updatePhoto(userId, body, caller);
        return ResponseEntity.ok(ApiResponse.ok(updated, "Photo mise à jour avec succès."));
    }

    @DeleteMapping("/users/{userId}")
    @Operation(
        summary = "Supprimer un profil",
        description = "Supprime définitivement un profil utilisateur. Réservé aux administrateurs."
    )
    public ResponseEntity<Void> deleteProfile(
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
        description = "Retourne la liste de tous les utilisateurs."
    )
    public ResponseEntity<ApiResponse<List<UserProfileResponse>>> listUsers(
        HttpServletRequest request
    ) {
        JwtClaims caller = getClaims(request);
        return ResponseEntity.ok(ApiResponse.ok(userService.listUsers(caller)));
    }

    // ──────────────────────────── AVIS ─────────────────────────────────────

    @PostMapping("/users/{userId}/avis")
    @Operation(
        summary = "Soumettre un avis",
        description = "Permet à un voyageur de soumettre un avis sur une agence."
    )
    public ResponseEntity<ApiResponse<AvisResponse>> submitAvis(
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
        @PathVariable UUID userId,
        HttpServletRequest request
    ) {
        JwtClaims caller = getClaims(request);
        return ResponseEntity.ok(ApiResponse.ok(userService.getUserAvis(userId, caller)));
    }

    @DeleteMapping("/users/{userId}/avis/{avisId}")
    @Operation(
        summary = "Supprimer un avis",
        description = "Supprime un avis existant."
    )
    public ResponseEntity<Void> deleteAvis(
        @PathVariable UUID userId,
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
        description = "Retourne les avis visibles d'une agence (paginé). Endpoint public.",
        security = {}
    )
    public ResponseEntity<ApiResponse<Page<AvisResponse>>> getAgenceAvis(
        @PathVariable UUID agenceId,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "10") int size
    ) {
        return ResponseEntity.ok(ApiResponse.ok(
            userService.getAgenceAvis(agenceId, PageRequest.of(page, size))
        ));
    }

    @GetMapping("/avis/agence/{agenceId}/stats")
    @Operation(
        summary = "Statistiques des avis d'une agence",
        description = "Retourne la note moyenne d'une agence. Endpoint public.",
        security = {}
    )
    public ResponseEntity<ApiResponse<Map<String, Object>>> getAgenceStats(
        @PathVariable UUID agenceId
    ) {
        double moyenne = userService.getNoteMoyenne(agenceId);
        return ResponseEntity.ok(ApiResponse.ok(
            Map.of("agenceId", agenceId, "noteMoyenne", moyenne)
        ));
    }

    // ──────────────────────── ADMINISTRATEUR ───────────────────────────────

    @PostMapping("/admin/managers-globaux")
    @Operation(
        summary = "Créer un ManagerGlobal",
        description = "Crée un nouveau ManagerGlobal. Réservé aux administrateurs."
    )
    public ResponseEntity<ApiResponse<Void>> createManagerGlobal(
        @Valid @RequestBody CreateManagerGlobalRequest request,
        HttpServletRequest httpRequest
    ) {
        JwtClaims caller = getClaims(httpRequest);
        userService.createManagerGlobal(request, caller);
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(ApiResponse.ok(null, "ManagerGlobal créé avec succès. Mot de passe temporaire: 0000"));
    }

    // ──────────────────────── MANAGER GLOBAL ───────────────────────────────

    @GetMapping("/agences/{agenceId}/staff")
    @Operation(
        summary = "Lister tout le staff d'une agence",
        description = "ManagerGlobal: liste tous les ManagerLocal, Guichetier, Chauffeur de son agence."
    )
    public ResponseEntity<ApiResponse<List<UserProfileResponse>>> listStaffByAgence(
        @PathVariable UUID agenceId,
        @RequestParam(required = false) String type,
        HttpServletRequest request
    ) {
        JwtClaims caller = getClaims(request);
        return ResponseEntity.ok(ApiResponse.ok(userService.listStaffByAgence(agenceId, type, caller)));
    }

    @GetMapping("/agences/{agenceId}/employes")
    @Operation(
        summary = "Lister les employés d'une agence",
        description = "ManagerGlobal: liste tous les Guichetier et Chauffeur de son agence."
    )
    public ResponseEntity<ApiResponse<List<UserProfileResponse>>> listEmployesByAgence(
        @PathVariable UUID agenceId,
        HttpServletRequest request
    ) {
        JwtClaims caller = getClaims(request);
        return ResponseEntity.ok(ApiResponse.ok(userService.listEmployesByAgence(agenceId, caller)));
    }

    @GetMapping("/agences/{agenceId}/filiales/{filialeId}/employes")
    @Operation(
        summary = "Lister les employés d'une filiale spécifique",
        description = "ManagerGlobal: liste les employés d'une filiale de son agence."
    )
    public ResponseEntity<ApiResponse<List<UserProfileResponse>>> listEmployesByAgenceAndFiliale(
        @PathVariable UUID agenceId,
        @PathVariable UUID filialeId,
        HttpServletRequest request
    ) {
        JwtClaims caller = getClaims(request);
        return ResponseEntity.ok(ApiResponse.ok(
            userService.listEmployesByAgenceAndFiliale(agenceId, filialeId, caller)
        ));
    }

    @PostMapping("/agences/{agenceId}/managers-locaux")
    @Operation(
        summary = "Créer un ManagerLocal",
        description = "ManagerGlobal crée un ManagerLocal dans son agence."
    )
    public ResponseEntity<ApiResponse<Void>> createManagerLocal(
        @PathVariable UUID agenceId,
        @Valid @RequestBody CreateManagerLocalRequest request,
        HttpServletRequest httpRequest
    ) {
        JwtClaims caller = getClaims(httpRequest);
        userService.createManagerLocal(agenceId, request, caller);
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(ApiResponse.ok(null, "ManagerLocal créé avec succès. Mot de passe temporaire: 0000"));
    }

    // ──────────────────────── MANAGER LOCAL ────────────────────────────────

    @GetMapping("/filiales/{filialeId}/employes")
    @Operation(
        summary = "Lister les employés d'une filiale",
        description = "ManagerLocal: liste tous les Guichetier et Chauffeur de sa filiale."
    )
    public ResponseEntity<ApiResponse<List<UserProfileResponse>>> listEmployesByFiliale(
        @PathVariable UUID filialeId,
        HttpServletRequest request
    ) {
        JwtClaims caller = getClaims(request);
        return ResponseEntity.ok(ApiResponse.ok(userService.listEmployesByFiliale(filialeId, caller)));
    }

    @GetMapping("/filiales/{filialeId}/guichetiers")
    @Operation(
        summary = "Lister les guichetiers d'une filiale",
        description = "ManagerLocal: liste tous les guichetiers de sa filiale."
    )
    public ResponseEntity<ApiResponse<List<UserProfileResponse>>> listGuichetiersByFiliale(
        @PathVariable UUID filialeId,
        HttpServletRequest request
    ) {
        JwtClaims caller = getClaims(request);
        return ResponseEntity.ok(ApiResponse.ok(userService.listGuichetiersByFiliale(filialeId, caller)));
    }

    @GetMapping("/filiales/{filialeId}/chauffeurs")
    @Operation(
        summary = "Lister les chauffeurs d'une filiale",
        description = "ManagerLocal: liste tous les chauffeurs de sa filiale."
    )
    public ResponseEntity<ApiResponse<List<UserProfileResponse>>> listChauffeursByFiliale(
        @PathVariable UUID filialeId,
        HttpServletRequest request
    ) {
        JwtClaims caller = getClaims(request);
        return ResponseEntity.ok(ApiResponse.ok(userService.listChauffeursByFiliale(filialeId, caller)));
    }

    @PostMapping("/filiales/{filialeId}/guichetiers")
    @Operation(
        summary = "Créer un guichetier",
        description = "ManagerLocal crée un guichetier dans sa filiale."
    )
    public ResponseEntity<ApiResponse<Void>> createGuichetier(
        @PathVariable UUID filialeId,
        @Valid @RequestBody CreateGuichetierRequest request,
        HttpServletRequest httpRequest
    ) {
        JwtClaims caller = getClaims(httpRequest);
        userService.createGuichetier(filialeId, request, caller);
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(ApiResponse.ok(null, "Guichetier créé avec succès. Mot de passe temporaire: 0000"));
    }

    @PostMapping("/filiales/{filialeId}/chauffeurs")
    @Operation(
        summary = "Créer un chauffeur",
        description = "ManagerLocal crée un chauffeur dans sa filiale."
    )
    public ResponseEntity<ApiResponse<Void>> createChauffeur(
        @PathVariable UUID filialeId,
        @Valid @RequestBody CreateChauffeurRequest request,
        HttpServletRequest httpRequest
    ) {
        JwtClaims caller = getClaims(httpRequest);
        userService.createChauffeur(filialeId, request, caller);
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(ApiResponse.ok(null, "Chauffeur créé avec succès. Mot de passe temporaire: 0000"));
    }

    // ──────────────────────── SUPPRESSION STAFF ────────────────────────────

    @DeleteMapping("/staff/{staffId}")
    @Operation(
        summary = "Supprimer un compte staff",
        description = "Supprime un compte staff (Guichetier, Chauffeur, ManagerLocal, ManagerGlobal)."
    )
    public ResponseEntity<Void> deleteStaff(
        @PathVariable UUID staffId,
        HttpServletRequest request
    ) {
        JwtClaims caller = getClaims(request);
        userService.deleteStaff(staffId, caller);
        return ResponseEntity.noContent().build();
    }

    // ───────────────────────────── HELPERS ─────────────────────────────────

    private JwtClaims getClaims(HttpServletRequest request) {
        return (JwtClaims) request.getAttribute(JwtMiddleware.CLAIMS_ATTR);
    }
}
