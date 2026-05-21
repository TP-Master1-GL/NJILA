package com.njila.njila_user_service.exception;

public class ManagerLocalAlreadyExistsException extends RuntimeException {
    public ManagerLocalAlreadyExistsException(String filialeNom) {
        super("Un ManagerLocal existe déjà pour la filiale : " + filialeNom);
    }
}