package com.njila.njila_user_service.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FilialeResponse {
    private UUID idFiliale;
    private String nom;
    private String adresse;
    private String ville;
    private UUID agenceId;
    private String agenceNom;
    private boolean isActive;
    private LocalDateTime createdAt;
}