package com.njila.njila_user_service.exception;

public class AvisAlreadyExistsException extends RuntimeException {
    public AvisAlreadyExistsException() {
        super("Vous avez déjà soumis un avis pour cette agence.");
    }
}