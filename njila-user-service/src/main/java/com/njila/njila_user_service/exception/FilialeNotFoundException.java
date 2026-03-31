package com.njila.njila_user_service.exception;

/** Filiale introuvable lors de la validation avant création staff — 404. */
public class FilialeNotFoundException extends RuntimeException {
    public FilialeNotFoundException(String filialeId) {
        super("Filiale introuvable : " + filialeId + ". Vérifiez que la filiale a bien été créée.");
    }
}