package com.njila.njila_user_service.exception;

public class FilialeNotFoundException extends RuntimeException {
    public FilialeNotFoundException(String filialeId) {
        super("Filiale introuvable : " + filialeId + ". Vérifiez que la filiale a bien été créée.");
    }
}