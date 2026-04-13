package com.njila.njila_user_service.exception;

public class UnauthorizedRoleHierarchyException extends RuntimeException {
    public UnauthorizedRoleHierarchyException(String message) {
        super(message);
    }
    
    public UnauthorizedRoleHierarchyException(String creatorRole, String targetRole) {
        super("Un " + creatorRole + " ne peut pas créer un " + targetRole + ".");
    }
}