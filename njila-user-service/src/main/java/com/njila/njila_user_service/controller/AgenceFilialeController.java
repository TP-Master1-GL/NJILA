package com.njila.njila_user_service.controller;

import com.njila.njila_user_service.dto.response.AgenceResponse;
import com.njila.njila_user_service.dto.response.FilialeResponse;
import com.njila.njila_user_service.middleware.JwtClaims;
import com.njila.njila_user_service.service.AgenceFilialeService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/agences-filiales")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Agences & Filiales", description = "Endpoints pour la consultation des agences et filiales")
public class AgenceFilialeController {

    private final AgenceFilialeService agenceFilialeService;

    // ==================== AGENCES ====================

    @GetMapping("/agences")
    @Operation(summary = "Liste de toutes les agences")
    public ResponseEntity<List<AgenceResponse>> getAllAgences() {
        log.info("[API] GET /agences-filiales/agences");
        return ResponseEntity.ok(agenceFilialeService.getAllAgences());
    }

    @GetMapping("/agences/actives")
    @Operation(summary = "Liste des agences actives uniquement")
    public ResponseEntity<List<AgenceResponse>> getActiveAgences() {
        log.info("[API] GET /agences-filiales/agences/actives");
        return ResponseEntity.ok(agenceFilialeService.getActiveAgences());
    }

    @GetMapping("/agences/{agenceId}")
    @Operation(summary = "Récupère une agence par son ID")
    public ResponseEntity<AgenceResponse> getAgenceById(@PathVariable UUID agenceId) {
        log.info("[API] GET /agences-filiales/agences/{}", agenceId);
        return ResponseEntity.ok(agenceFilialeService.getAgenceById(agenceId));
    }

    // ==================== FILIALES ====================

    @GetMapping("/filiales")
    @Operation(summary = "Liste de toutes les filiales")
    public ResponseEntity<List<FilialeResponse>> getAllFiliales() {
        log.info("[API] GET /agences-filiales/filiales");
        return ResponseEntity.ok(agenceFilialeService.getAllFiliales());
    }

    @GetMapping("/filiales/actives")
    @Operation(summary = "Liste des filiales actives uniquement")
    public ResponseEntity<List<FilialeResponse>> getActiveFiliales() {
        log.info("[API] GET /agences-filiales/filiales/actives");
        return ResponseEntity.ok(agenceFilialeService.getActiveFiliales());
    }

    @GetMapping("/filiales/{filialeId}")
    @Operation(summary = "Récupère une filiale par son ID")
    public ResponseEntity<FilialeResponse> getFilialeById(@PathVariable UUID filialeId) {
        log.info("[API] GET /agences-filiales/filiales/{}", filialeId);
        return ResponseEntity.ok(agenceFilialeService.getFilialeById(filialeId));
    }

    // ==================== FILIALES PAR AGENCE ====================

    @GetMapping("/agences/{agenceId}/filiales")
    @Operation(summary = "Liste des filiales d'une agence spécifique")
    public ResponseEntity<List<FilialeResponse>> getFilialesByAgence(@PathVariable UUID agenceId) {
        log.info("[API] GET /agences-filiales/agences/{}/filiales", agenceId);
        return ResponseEntity.ok(agenceFilialeService.getFilialesByAgence(agenceId));
    }

    // ==================== UTILITAIRES ====================

    @GetMapping("/check/agence/{agenceId}")
    @Operation(summary = "Vérifie si une agence existe")
    public ResponseEntity<Boolean> agenceExists(@PathVariable UUID agenceId) {
        log.info("[API] GET /agences-filiales/check/agence/{}", agenceId);
        return ResponseEntity.ok(agenceFilialeService.agenceExists(agenceId));
    }

    @GetMapping("/check/filiale/{filialeId}")
    @Operation(summary = "Vérifie si une filiale existe")
    public ResponseEntity<Boolean> filialeExists(@PathVariable UUID filialeId) {
        log.info("[API] GET /agences-filiales/check/filiale/{}", filialeId);
        return ResponseEntity.ok(agenceFilialeService.filialeExists(filialeId));
    }
}