package com.njila.njila_user_service.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
public class ManagerGlobalResponse {
    private UUID idUser;
    private String name;
    private String surname;
    private String email;
    private String phone;
    private String adresse;
    private String photoProfil;
    private UUID agenceId;
    private boolean isActive;
    private LocalDateTime dateInscription;
    private LocalDateTime derniereConnexion;
}