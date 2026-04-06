package com.njila.njila_user_service.service;

import com.njila.njila_user_service.dto.request.AvisRequest;
import com.njila.njila_user_service.dto.request.CreateStaffRequest;
import com.njila.njila_user_service.dto.request.UpdatePhotoRequest;
import com.njila.njila_user_service.dto.request.UpdateProfileRequest;
import com.njila.njila_user_service.dto.response.AvisResponse;
import com.njila.njila_user_service.dto.response.UserProfileResponse;
import com.njila.njila_user_service.middleware.JwtClaims;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.UUID;

/**
 * Interface métier du user-service v2.0.
 */
public interface UserService {

    // ── Profil ────────────────────────────────────────────────────────────
    UserProfileResponse getProfile(UUID userId, JwtClaims caller);

    UserProfileResponse updateProfile(UUID userId, UpdateProfileRequest request, JwtClaims caller);

    UserProfileResponse updatePhoto(UUID userId, UpdatePhotoRequest request, JwtClaims caller);

    void deleteProfile(UUID userId, JwtClaims caller);

    List<UserProfileResponse> listUsers(JwtClaims caller);

    // ── Staff ─────────────────────────────────────────────────────────────
    void createStaff(CreateStaffRequest request, JwtClaims caller);

    // ── Avis ──────────────────────────────────────────────────────────────
    AvisResponse submitAvis(UUID userId, AvisRequest request, JwtClaims caller);

    List<AvisResponse> getUserAvis(UUID userId, JwtClaims caller);

    Page<AvisResponse> getAgenceAvis(UUID agenceId, Pageable pageable);

    void deleteAvis(UUID userId, UUID avisId, JwtClaims caller);

    double getNoteMoyenne(UUID agenceId);
}