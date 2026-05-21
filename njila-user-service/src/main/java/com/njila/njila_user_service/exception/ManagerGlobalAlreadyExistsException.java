package com.njila.njila_user_service.exception;

public class ManagerGlobalAlreadyExistsException extends RuntimeException {
    public ManagerGlobalAlreadyExistsException(String agenceNom) {
        super("Un ManagerGlobal existe déjà pour l'agence : " + agenceNom);
    }
}