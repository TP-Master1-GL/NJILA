package com.njila.exception;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

/**
 * Gestionnaire global d'exceptions — formate toutes les erreurs en JSON cohérent.
 */
@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    // ------------------------------------------------------------------ 404
    @ExceptionHandler(ReservationNotFoundException.class)
    public ResponseEntity<Map<String, Object>> handleNotFound(ReservationNotFoundException ex) {
        log.warn("[BOOKING] Ressource introuvable : {}", ex.getMessage());
        return buildResponse(HttpStatus.NOT_FOUND, ex.getMessage());
    }

    // ------------------------------------------------------------------ 409
    @ExceptionHandler(PlacesInsuffisantesException.class)
    public ResponseEntity<Map<String, Object>> handlePlacesInsuffisantes(PlacesInsuffisantesException ex) {
        log.warn("[BOOKING] Places insuffisantes : {}", ex.getMessage());
        return buildResponse(HttpStatus.CONFLICT, ex.getMessage());
    }

    @ExceptionHandler(ReservationDejaPriseException.class)
    public ResponseEntity<Map<String, Object>> handleDejaPrise(ReservationDejaPriseException ex) {
        log.warn("[BOOKING] Réservation déjà prise : {}", ex.getMessage());
        return buildResponse(HttpStatus.CONFLICT, ex.getMessage());
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<Map<String, Object>> handleIllegalState(IllegalStateException ex) {
        log.warn("[BOOKING] État invalide : {}", ex.getMessage());
        return buildResponse(HttpStatus.CONFLICT, ex.getMessage());
    }

    // ------------------------------------------------------------------ 400
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException ex) {
        Map<String, String> erreurs = new HashMap<>();
        ex.getBindingResult().getAllErrors().forEach(error -> {
            String field = ((FieldError) error).getField();
            erreurs.put(field, error.getDefaultMessage());
        });
        log.warn("[BOOKING] Validation échouée : {}", erreurs);

        Map<String, Object> body = new HashMap<>();
        body.put("timestamp", LocalDateTime.now().toString());
        body.put("statut", HttpStatus.BAD_REQUEST.value());
        body.put("erreur", "Erreur de validation");
        body.put("message", "Champs invalides");
        body.put("details", erreurs);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }

    // ------------------------------------------------------------------ 503
    @ExceptionHandler(ServiceIndisponibleException.class)
    public ResponseEntity<Map<String, Object>> handleServiceIndisponible(ServiceIndisponibleException ex) {
        log.error("[BOOKING] Service externe indisponible : {}", ex.getMessage());
        return buildResponse(HttpStatus.SERVICE_UNAVAILABLE, ex.getMessage());
    }

    // ------------------------------------------------------------------ 500
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleGeneric(Exception ex) {
        log.error("[BOOKING] Erreur interne inattendue", ex);
        return buildResponse(HttpStatus.INTERNAL_SERVER_ERROR,
                "Erreur interne du serveur. Veuillez réessayer ultérieurement.");
    }

    // ------------------------------------------------------------------ Util
    private ResponseEntity<Map<String, Object>> buildResponse(HttpStatus status, String message) {
        Map<String, Object> body = new HashMap<>();
        body.put("timestamp", LocalDateTime.now().toString());
        body.put("statut", status.value());
        body.put("erreur", status.getReasonPhrase());
        body.put("message", message);
        return ResponseEntity.status(status).body(body);
    }
}