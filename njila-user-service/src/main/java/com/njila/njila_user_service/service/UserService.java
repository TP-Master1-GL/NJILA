package com.njila.njila_user_service.service;

import com.njila.njila_user_service.dto.request.*;
import com.njila.njila_user_service.dto.response.AvisResponse;
import com.njila.njila_user_service.dto.response.UserProfileResponse;
import com.njila.njila_user_service.middleware.JwtClaims;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.UUID;

public interface UserService {

    // ── Profil ────────────────────────────────────────────────────────────
    UserProfileResponse getProfile(UUID userId, JwtClaims caller);
    UserProfileResponse updateProfile(UUID userId, UpdateProfileRequest request, JwtClaims caller);
    UserProfileResponse updatePhoto(UUID userId, UpdatePhotoRequest request, JwtClaims caller);
    void deleteProfile(UUID userId, JwtClaims caller);
    List<UserProfileResponse> listUsers(JwtClaims caller);

    // ── Avis ──────────────────────────────────────────────────────────────
    AvisResponse submitAvis(UUID userId, AvisRequest request, JwtClaims caller);
    List<AvisResponse> getUserAvis(UUID userId, JwtClaims caller);
    Page<AvisResponse> getAgenceAvis(UUID agenceId, Pageable pageable);
    void deleteAvis(UUID userId, UUID avisId, JwtClaims caller);
    double getNoteMoyenne(UUID agenceId);
    
    // ── Gestion staff par agence/filiale (NOUVEAU) ─────────────────────────
    
    // Pour ManagerGlobal
    List<UserProfileResponse> listStaffByAgence(UUID agenceId, String type, JwtClaims caller);
    List<UserProfileResponse> listEmployesByAgence(UUID agenceId, JwtClaims caller);
    List<UserProfileResponse> listEmployesByAgenceAndFiliale(UUID agenceId, UUID filialeId, JwtClaims caller);
    void createManagerLocal(UUID agenceId, CreateManagerLocalRequest request, JwtClaims caller);
    
    // Pour ManagerLocal
    List<UserProfileResponse> listEmployesByFiliale(UUID filialeId, JwtClaims caller);
    List<UserProfileResponse> listGuichetiersByFiliale(UUID filialeId, JwtClaims caller);
    List<UserProfileResponse> listChauffeursByFiliale(UUID filialeId, JwtClaims caller);
    void createGuichetier(UUID filialeId, CreateGuichetierRequest request, JwtClaims caller);
    void createChauffeur(UUID filialeId, CreateChauffeurRequest request, JwtClaims caller);
    
    // Pour Admin
    void createManagerGlobal(CreateManagerGlobalRequest request, JwtClaims caller);
    
    // Suppression staff
    void deleteStaff(UUID staffId, JwtClaims caller);
}