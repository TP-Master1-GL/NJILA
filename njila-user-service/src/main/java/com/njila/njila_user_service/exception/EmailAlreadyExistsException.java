package com.njila.njila_user_service.exception;

public class EmailAlreadyExistsException extends RuntimeException {
    public EmailAlreadyExistsException(String email) {
        super("Un compte existe déjà avec l'email : " + email);
    }
}