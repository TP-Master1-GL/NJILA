package com.njila.njila_user_service.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
public class AvisResponse {
    private UUID          id;
    private UUID          agenceId;
    private String        agenceNom;
    private String        auteurName;
    private String        auteurSurname;
    private int           note;
    private String        commentaire;
    private boolean       visible;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}