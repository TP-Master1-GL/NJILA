package com.njila.njila_user_service.middleware;

import com.njila.njila_user_service.enums.Role;
import lombok.Builder;
import lombok.Data;

import java.util.UUID;

/**
 * Données extraites du JWT par le middleware.
 * Encodées dans le token par l'auth-service.
 */
@Data
@Builder
public class JwtClaims {
    private UUID   userId;
    private Role   role;
    private String sessionId;
    private UUID   filialeId;
    private UUID   agenceId;
    private long   exp;
}