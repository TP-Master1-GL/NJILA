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
    private UUID   filialeId;
    private UUID   agenceId;
    private boolean isActive;

    private LocalDateTime dateInscription;
    private LocalDateTime derniereConnexion;

    private String        historiqueResa;    // Voyageur
    private String        poste;             // Guichetier
    private String        numeroPermis;      // Chauffeur
    private UUID          idVoyageActuel;    // Chauffeur
    private Boolean       disponible;        // Chauffeur
    private LocalDateTime dateEmbauche;      // Chauffeur
    private Integer       niveauAcces;       // Administrateur
    private UUID          idAgenceManager;   // ManagerGlobal
}