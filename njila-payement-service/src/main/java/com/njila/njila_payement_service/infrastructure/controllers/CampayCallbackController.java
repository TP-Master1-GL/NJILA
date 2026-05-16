package com.njila.njila_payement_service.infrastructure.controllers;

import com.njila.njila_payement_service.infrastructure.webhook.WebHookHandler;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("api/v1/payment/callback")
@RequiredArgsConstructor
@Slf4j
public class CampayCallbackController {

    private final WebHookHandler webHookHandler;

    /**
     * URL à configurer dans le dashboard Campay :
     *   POST https://ton-domaine/api/v1/payment/callback/campay
     *
     * Campay envoie un POST dès que le statut de la transaction change.
     * On renvoie toujours 200 pour éviter que Campay ne relance indéfiniment.
     */
    @PostMapping("/campay")
    public ResponseEntity<Void> handleCampayCallback(
            @RequestBody Map<String, Object> payload) {

        log.info("[CALLBACK] POST /campay reçu");

        try {
            webHookHandler.handle(payload);
        } catch (Exception e) {
            // Log mais 200 quand même — Campay ne doit pas retenter en boucle
            log.error("[CALLBACK] Erreur traitement : {}", e.getMessage(), e);
        }

        return ResponseEntity.ok().build();
    }
}
