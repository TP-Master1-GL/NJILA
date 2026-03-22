package com.njila.njila_booking_service.controller;

import com.njila.njila_booking_service.client.ServiceIndisponibleException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.stream.Collectors;

@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    // ─── Service distant indisponible (fleet / user) ──────────────────────────
    @ExceptionHandler(ServiceIndisponibleException.class)
    public ResponseEntity<Map<String, Object>> handleServiceIndisponible(
            ServiceIndisponibleException ex) {
        log.warn("[EXCEPTION] Service indisponible : {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of(
                "timestamp", LocalDateTime.now().toString(),
                "status",    503,
                "error",     "Service Unavailable",
                "message",   ex.getMessage()
        ));
    }

    // ─── Validation des champs (@Valid) ───────────────────────────────────────
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(
            MethodArgumentNotValidException ex) {
        String erreurs = ex.getBindingResult()
                .getFieldErrors()
                .stream()
                .map(f -> f.getField() + " : " + f.getDefaultMessage())
                .collect(Collectors.joining(", "));
        log.warn("[EXCEPTION] Validation : {}", erreurs);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of(
                "timestamp", LocalDateTime.now().toString(),
                "status",    400,
                "error",     "Validation Failed",
                "message",   erreurs
        ));
    }

    // ─── Ressource introuvable ────────────────────────────────────────────────
    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<Map<String, Object>> handleRuntimeException(
            RuntimeException ex) {
        log.error("[EXCEPTION] RuntimeException : {}", ex.getMessage());

        if (ex.getMessage() != null
                && ex.getMessage().toLowerCase().contains("introuvable")) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of(
                    "timestamp", LocalDateTime.now().toString(),
                    "status",    404,
                    "error",     "Not Found",
                    "message",   ex.getMessage()
            ));
        }

        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of(
                "timestamp", LocalDateTime.now().toString(),
                "status",    400,
                "error",     "Bad Request",
                "message",   ex.getMessage() != null
                        ? ex.getMessage() : "Erreur inattendue"
        ));
    }
}