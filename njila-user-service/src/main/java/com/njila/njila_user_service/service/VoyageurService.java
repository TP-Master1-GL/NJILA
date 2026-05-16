package com.njila.njila_user_service.service;

import com.njila.njila_user_service.dto.request.AvisRequest;
import com.njila.njila_user_service.dto.request.UpdateProfileRequest;
import com.njila.njila_user_service.dto.response.AvisResponse;
import com.njila.njila_user_service.dto.response.UserProfileResponse;
import com.njila.njila_user_service.middleware.JwtClaims;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.UUID;

public interface VoyageurService {
    UserProfileResponse getProfile(UUID userId, JwtClaims caller);
    UserProfileResponse updateProfile(UUID userId, UpdateProfileRequest request, JwtClaims caller);
    AvisResponse submitAvis(UUID userId, AvisRequest request, JwtClaims caller);
    List<AvisResponse> getUserAvis(UUID userId, JwtClaims caller);
    Page<AvisResponse> getAgenceAvis(UUID agenceId, Pageable pageable);
    void deleteAvis(UUID userId, UUID avisId, JwtClaims caller);
    double getNoteMoyenne(UUID agenceId);
}