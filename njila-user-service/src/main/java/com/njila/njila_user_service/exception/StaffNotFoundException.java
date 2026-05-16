package com.njila.njila_user_service.exception;

import java.util.UUID;

public class StaffNotFoundException extends RuntimeException {
    public StaffNotFoundException(String staffId) {
        super("Staff introuvable : " + staffId);
    }
    
    public StaffNotFoundException(UUID staffId) {
        super("Staff introuvable : " + staffId.toString());
    }
}