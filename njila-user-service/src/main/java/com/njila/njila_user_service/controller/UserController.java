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
import com.njila.njila_user_service.service.UserService;
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

/**
 * UserController — diagramme composants user-service.
 *
 * ── Profil ────────────────────────────────────────────────────────────────────
 *  GET    /api/users/{userId}               → getProfile
 *  PUT    /api/users/{userId}               → updateProfile
 *  DELETE /api/users/{userId}               → deleteProfile
 *  GET    /api/users                        → listUsers
 *
 * ── Staff ─────────────────────────────────────────────────────────────────────
 *  POST   /api/users/guichetiers            → createStaff (GUICHETIER)
 *  POST   /api/users/chauffeurs             → createStaff (CHAUFFEUR)
 *  POST   /api/users/managers               → createStaff (MANAGER_LOCAL/GLOBAL)
 *
 * ── Avis ──────────────────────────────────────────────────────────────────────
 *  POST   /api/users/{userId}/avis          → submitAvis
 *  GET    /api/users/{userId}/avis          → getUserAvis
 *  DELETE /api/users/{userId}/avis/{avisId} → deleteAvis
 *  GET    /api/avis/agence/{agenceId}       → getAgenceAvis (public)
 *  GET    /api/avis/agence/{agenceId}/stats → getNoteMoyenne (public)
 *
 * ── Health ────────────────────────────────────────────────────────────────────
 *  GET    /api/users/health                 → health check Eureka
 */
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
@Slf4j
public class UserController {

    private final UserService userService;

    // ── Health ─────────────────────────────────────────────────────────────

    @GetMapping("/users/health")
    public ResponseEntity<ApiResponse<String>> health() {
        return ResponseEntity.ok(ApiResponse.ok("UP", "njila-user-service"));
    }

    // ── Profil ─────────────────────────────────────────────────────────────

    /**
     * GET /api/users/{userId}
     * 401 → JWT absent/invalide
     * 403 → non autorisé à consulter ce profil
     * 400 → UUID invalide
     * 404 → profil introuvable
     * 200 → { UserProfile }
     */
    @GetMapping("/users/{userId}")
    public ResponseEntity<ApiResponse<UserProfileResponse>> getProfile(
        @PathVariable UUID userId,
        HttpServletRequest request
    ) {
        JwtClaims caller = getClaims(request);
        return ResponseEntity.ok(ApiResponse.ok(userService.getProfile(userId, caller)));
    }

    /**
     * PUT /api/users/{userId}
     * 401 → JWT absent
     * 403 → non propriétaire + non admin
     * 404 → profil introuvable
     * 200 → { UserProfile mis à jour }
     */
    @PutMapping("/users/{userId}")
    public ResponseEntity<ApiResponse<UserProfileResponse>> updateProfile(
        @PathVariable UUID userId,
        @Valid @RequestBody UpdateProfileRequest body,
        HttpServletRequest request
    ) {
        JwtClaims caller = getClaims(request);
        UserProfileResponse updated = userService.updateProfile(userId, body, caller);
        return ResponseEntity.ok(ApiResponse.ok(updated, "Profil mis à jour avec succès."));
    }

    /**
     * DELETE /api/users/{userId}
     * 401 → JWT absent
     * 403 → non administrateur
     * 404 → profil introuvable
     * 204 → No Content
     */
    @DeleteMapping("/users/{userId}")
    public ResponseEntity<Void> deleteProfile(
        @PathVariable UUID userId,
        HttpServletRequest request
    ) {
        JwtClaims caller = getClaims(request);
        userService.deleteProfile(userId, caller);
        return ResponseEntity.noContent().build();
    }

    /**
     * GET /api/users — liste tous les utilisateurs (managers + admin)
     */
    @GetMapping("/users")
    public ResponseEntity<ApiResponse<List<UserProfileResponse>>> listUsers(
        HttpServletRequest request
    ) {
        JwtClaims caller = getClaims(request);
        return ResponseEntity.ok(ApiResponse.ok(userService.listUsers(caller)));
    }

    // ── Staff ──────────────────────────────────────────────────────────────

    /**
     * POST /api/users/guichetiers
     * 401 → JWT absent | 403 → non manager | 409 → email existant | 201 → Created
     */
    @PostMapping("/users/guichetiers")
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

    /**
     * POST /api/users/{userId}/avis
     * Voyageur uniquement. 409 si avis déjà soumis pour cette agence.
     */
    @PostMapping("/users/{userId}/avis")
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

    /**
     * GET /api/users/{userId}/avis — tous les avis d'un utilisateur
     */
    @GetMapping("/users/{userId}/avis")
    public ResponseEntity<ApiResponse<List<AvisResponse>>> getUserAvis(
        @PathVariable UUID userId,
        HttpServletRequest request
    ) {
        JwtClaims caller = getClaims(request);
        return ResponseEntity.ok(ApiResponse.ok(userService.getUserAvis(userId, caller)));
    }

    /**
     * DELETE /api/users/{userId}/avis/{avisId}
     * Auteur ou Administrateur uniquement.
     */
    @DeleteMapping("/users/{userId}/avis/{avisId}")
    public ResponseEntity<Void> deleteAvis(
        @PathVariable UUID userId,
        @PathVariable UUID avisId,
        HttpServletRequest request
    ) {
        JwtClaims caller = getClaims(request);
        userService.deleteAvis(userId, avisId, caller);
        return ResponseEntity.noContent().build();
    }

    /**
     * GET /api/avis/agence/{agenceId} — avis publics d'une agence (paginé)
     * Endpoint public — aucun JWT requis.
     */
    @GetMapping("/avis/agence/{agenceId}")
    public ResponseEntity<ApiResponse<Page<AvisResponse>>> getAgenceAvis(
        @PathVariable UUID agenceId,
        @RequestParam(defaultValue = "0")  int page,
        @RequestParam(defaultValue = "10") int size
    ) {
        return ResponseEntity.ok(ApiResponse.ok(
            userService.getAgenceAvis(agenceId, PageRequest.of(page, size))
        ));
    }

    /**
     * GET /api/avis/agence/{agenceId}/stats — note moyenne (public)
     */
    @GetMapping("/avis/agence/{agenceId}/stats")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getAgenceStats(
        @PathVariable UUID agenceId
    ) {
        double moyenne = userService.getNoteMoyenne(agenceId);
        return ResponseEntity.ok(ApiResponse.ok(
            Map.of("agenceId", agenceId, "noteMoyenne", moyenne)
        ));
    }

    // ── Helper ─────────────────────────────────────────────────────────────

    private JwtClaims getClaims(HttpServletRequest request) {
        return (JwtClaims) request.getAttribute(JwtMiddleware.CLAIMS_ATTR);
    }
}