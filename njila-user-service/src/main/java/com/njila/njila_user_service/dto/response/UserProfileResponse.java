package com.njila.njila_user_service.dto.response;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.njila.njila_user_service.enums.Role;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import lombok.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor(force = true)  // ← IMPORTANT: force = true
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)  // ← IMPORTANT
public class UserProfileResponse {
    private UUID idUser;
    private String name;
    private String surname;
    private String email;
    private String phone;
    private String adresse;
    private String photoProfil;
    private Role role;
    private String userType;
    private boolean isActive = false;  // ← Donner une valeur par défaut
    private LocalDateTime dateInscription;
    private LocalDateTime derniereConnexion;
    private String historiqueResa;
    private String poste;
    private String numeroPermis;
    private UUID idVoyageActuel;
    private Boolean disponible;
    private UUID agenceId;
    private UUID filialeId;
    private LocalDateTime dateEmbauche;
}
