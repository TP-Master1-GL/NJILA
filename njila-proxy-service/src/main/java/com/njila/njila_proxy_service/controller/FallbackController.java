package com.njila.njila_proxy_service.controller;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.Map;

@RestController
@RequestMapping("/fallback")
@Slf4j
public class FallbackController {

    @GetMapping("/default")
    public ResponseEntity<Map<String, Object>> defaultFallback() {
        log.warn("[FALLBACK] Service indisponible");
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
            .body(Map.of(
                "timestamp", LocalDateTime.now(),
                "status", 503,
                "error", "Service Unavailable",
                "message", "Le service est temporairement indisponible. Veuillez réessayer plus tard."
            ));
    }

    @GetMapping("/auth")
    public ResponseEntity<Map<String, Object>> authFallback() {
        log.warn("[FALLBACK] Auth Service indisponible");
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
            .body(Map.of(
                "timestamp", LocalDateTime.now(),
                "status", 503,
                "error", "Service Unavailable",
                "message", "Le service d'authentification est indisponible."
            ));
    }

    @GetMapping("/user")
    public ResponseEntity<Map<String, Object>> userFallback() {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
            .body(Map.of(
                "timestamp", LocalDateTime.now(),
                "status", 503,
                "error", "Service Unavailable",
                "message", "Le service utilisateur est indisponible."
            ));
    }

    @GetMapping("/fleet")
    public ResponseEntity<Map<String, Object>> fleetFallback() {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
            .body(Map.of(
                "timestamp", LocalDateTime.now(),
                "status", 503,
                "error", "Service Unavailable",
                "message", "Le service de gestion de flotte est indisponible."
            ));
    }

    @GetMapping("/booking")
    public ResponseEntity<Map<String, Object>> bookingFallback() {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
            .body(Map.of(
                "timestamp", LocalDateTime.now(),
                "status", 503,
                "error", "Service Unavailable",
                "message", "Le service de réservation est indisponible."
            ));
    }

    @GetMapping("/payment")
    public ResponseEntity<Map<String, Object>> paymentFallback() {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
            .body(Map.of(
                "timestamp", LocalDateTime.now(),
                "status", 503,
                "error", "Service Unavailable",
                "message", "Le service de paiement est indisponible."
            ));
    }

    @GetMapping("/notification")
    public ResponseEntity<Map<String, Object>> notificationFallback() {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
            .body(Map.of(
                "timestamp", LocalDateTime.now(),
                "status", 503,
                "error", "Service Unavailable",
                "message", "Le service de notification est indisponible."
            ));
    }

    @GetMapping("/subscribe")
    public ResponseEntity<Map<String, Object>> subscribeFallback() {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
            .body(Map.of(
                "timestamp", LocalDateTime.now(),
                "status", 503,
                "error", "Service Unavailable",
                "message", "Le service d'abonnement est indisponible."
            ));
    }
}