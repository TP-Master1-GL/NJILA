package com.njila.njila_user_service.exception;

public class ProfileNotFoundException extends RuntimeException {
    public ProfileNotFoundException(String userId) {
        super("Profil introuvable pour l'utilisateur : " + userId);
    }
}