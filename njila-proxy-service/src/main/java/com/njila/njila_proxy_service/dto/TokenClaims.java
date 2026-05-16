package com.njila.njila_proxy_service.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class TokenClaims {
    private boolean valid;
    private String userId;
    private String role;
    private String sessionId;
    private String filialeId;
    private String agenceId;
    private long exp;
}