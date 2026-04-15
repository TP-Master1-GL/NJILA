package com.njila.njila_user_service.dto.request;

import com.njila.njila_user_service.dto.request.CreateStaffRequest;
import com.njila.njila_user_service.enums.Role;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

@Component
public class StaffRequestValidator {

    public Map<String, String> validate(CreateStaffRequest request) {
        Map<String, String> errors = new HashMap<>();
        
        if (request.getRole() == null) {
            errors.put("role", "Le rôle est obligatoire");
            return errors;
        }
        
        // Validation selon le rôle
        switch (request.getRole()) {
            case MANAGER_GLOBAL:
                if (request.getAgenceId() == null || request.getAgenceId().isBlank()) {
                    errors.put("agenceId", "L'ID agence est obligatoire pour MANAGER_GLOBAL");
                }
                // filialeId n'est PAS obligatoire pour MANAGER_GLOBAL
                break;
                
            case MANAGER_LOCAL:
                if (request.getAgenceId() == null || request.getAgenceId().isBlank()) {
                    errors.put("agenceId", "L'ID agence est obligatoire pour MANAGER_LOCAL");
                }
                if (request.getFilialeId() == null || request.getFilialeId().isBlank()) {
                    errors.put("filialeId", "L'ID filiale est obligatoire pour MANAGER_LOCAL");
                }
                break;
                
            case GUICHETIER:
                if (request.getFilialeId() == null || request.getFilialeId().isBlank()) {
                    errors.put("filialeId", "L'ID filiale est obligatoire pour GUICHETIER");
                }
                if (request.getPoste() == null || request.getPoste().isBlank()) {
                    errors.put("poste", "Le poste est obligatoire pour GUICHETIER");
                }
                break;
                
            case CHAUFFEUR:
                if (request.getFilialeId() == null || request.getFilialeId().isBlank()) {
                    errors.put("filialeId", "L'ID filiale est obligatoire pour CHAUFFEUR");
                }
                if (request.getNumeroPermis() == null || request.getNumeroPermis().isBlank()) {
                    errors.put("numeroPermis", "Le numéro de permis est obligatoire pour CHAUFFEUR");
                }
                break;
                
            default:
                break;
        }
        
        return errors;
    }
    
    public boolean isValid(CreateStaffRequest request) {
        return validate(request).isEmpty();
    }
}