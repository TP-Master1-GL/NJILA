package com.njila.njila_user_service.dto.request;

import com.njila.njila_user_service.enums.Role;
import lombok.Data;

import java.util.Set;
import java.util.UUID;

@Data
public class FilterStaffRequest {
    private Set<Role> roles;
    private UUID filialeId;
    private Boolean isActive;
    private Boolean disponible;
}