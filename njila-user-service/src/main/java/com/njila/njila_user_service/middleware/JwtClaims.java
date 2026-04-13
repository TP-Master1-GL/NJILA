package com.njila.njila_user_service.middleware;

import com.njila.njila_user_service.enums.Role;
import lombok.Builder;
import lombok.Data;

import java.util.UUID;


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