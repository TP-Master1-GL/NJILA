package com.njila.njila_user_service.service;

import com.njila.njila_user_service.dto.request.CreateChauffeurRequest;
import com.njila.njila_user_service.dto.request.CreateGuichetierRequest;
import com.njila.njila_user_service.dto.response.UserProfileResponse;
import com.njila.njila_user_service.middleware.JwtClaims;

import java.util.List;
import java.util.UUID;

public interface ManagerLocalService {
    List<UserProfileResponse> listEmployesByFiliale(UUID filialeId, JwtClaims caller);
    List<UserProfileResponse> listGuichetiersByFiliale(UUID filialeId, JwtClaims caller);
    List<UserProfileResponse> listChauffeursByFiliale(UUID filialeId, JwtClaims caller);
    void createGuichetier(UUID filialeId, CreateGuichetierRequest request, JwtClaims caller);
    void createChauffeur(UUID filialeId, CreateChauffeurRequest request, JwtClaims caller);
    void deleteEmploye(UUID employeId, JwtClaims caller);
}