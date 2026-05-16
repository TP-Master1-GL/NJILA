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
public class AgenceResponse {
    private UUID idAgence;
    private String nom;
    private String description;
    private boolean isActive;
    private LocalDateTime createdAt;
}