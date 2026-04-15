package com.njila.njila_user_service.exception;

public class InvalidInheritanceException extends RuntimeException {
    public InvalidInheritanceException(String message) {
        super(message);
    }
    
    public InvalidInheritanceException(String field, String expected, String actual) {
        super("Héritage invalide : " + field + " devrait être " + expected + " mais reçu " + actual);
    }
}