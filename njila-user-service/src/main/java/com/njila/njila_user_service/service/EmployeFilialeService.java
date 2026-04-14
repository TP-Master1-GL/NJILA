package com.njila.njila_user_service.service;

import com.njila.njila_user_service.dto.response.UserProfileResponse;
import com.njila.njila_user_service.middleware.JwtClaims;

import java.util.List;
import java.util.UUID;

public interface EmployeFilialeService {
    UserProfileResponse getEmployeProfile(UUID employeId, JwtClaims caller);
    List<UserProfileResponse> getAllEmployesByFiliale(UUID filialeId, JwtClaims caller);
    void updateDisponibilite(UUID chauffeurId, Boolean disponible, JwtClaims caller);
}