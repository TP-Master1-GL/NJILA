package com.njila.njila_user_service.service;

import com.njila.njila_user_service.dto.request.CreateManagerLocalRequest;
import com.njila.njila_user_service.dto.response.ManagerLocalResponse;
import com.njila.njila_user_service.dto.response.UserProfileResponse;
import com.njila.njila_user_service.middleware.JwtClaims;

import java.util.List;
import java.util.UUID;

public interface ManagerGlobalService {
    List<UserProfileResponse> listStaffByAgence(UUID agenceId, String type, JwtClaims caller);
    List<UserProfileResponse> listEmployesByAgence(UUID agenceId, JwtClaims caller);
    List<UserProfileResponse> listEmployesByAgenceAndFiliale(UUID agenceId, UUID filialeId, JwtClaims caller);
    ManagerLocalResponse createManagerLocal(UUID agenceId, CreateManagerLocalRequest request, JwtClaims caller);
    void deleteStaff(UUID staffId, JwtClaims caller);
}