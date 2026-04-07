// ListStaffRequest.java
package com.njila.njila_user_service.dto.request;

import com.njila.njila_user_service.enums.Role;
import lombok.Data;
import java.util.Set;

@Data
public class ListStaffRequest {
    private Set<Role> roles;  // null = tous les rôles
    private Boolean isActive;
}