package com.njila.njila_user_service.dto.response;

import com.njila.njila_user_service.enums.Role;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
public class UserProfileResponse {

    private UUID   idUser;
    private String name;
    private String surname;
    private String email;
    private String phone;
    private String adresse;
    private String photoProfil;
    private Role   role;
    private String userType;  // NOUVEAU : "ADMIN", "VOYAGEUR", "MANAGER_GLOBAL", "MANAGER_LOCAL", "GUICHETIER", "CHAUFFEUR"
    private boolean isActive;

    private LocalDateTime dateInscription;
    private LocalDateTime derniereConnexion;

    // Voyageur
    private String historiqueResa;

    // Guichetier
    private String poste;

    // Chauffeur
    private String numeroPermis;
    private UUID   idVoyageActuel;
    private Boolean disponible;

    // ManagerGlobal
    private UUID agenceId;

    // ManagerLocal, Guichetier, Chauffeur
    private UUID filialeId;
    
    private LocalDateTime dateEmbauche;
}