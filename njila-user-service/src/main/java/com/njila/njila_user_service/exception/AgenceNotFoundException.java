package com.njila.njila_user_service.exception;

/** Agence introuvable lors de la validation avant création staff/filiale — 404. */
public class AgenceNotFoundException extends RuntimeException {
    public AgenceNotFoundException(String agenceId) {
        super("Agence introuvable : " + agenceId + ". Vérifiez que l'agence a bien été créée.");
    }
}