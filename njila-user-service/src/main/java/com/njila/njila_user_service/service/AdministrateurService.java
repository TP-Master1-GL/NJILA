package com.njila.njila_user_service.service;

import com.njila.njila_user_service.dto.request.CreateManagerGlobalRequest;
import com.njila.njila_user_service.dto.response.ManagerGlobalResponse;
import com.njila.njila_user_service.middleware.JwtClaims;

import java.util.List;
import java.util.UUID;

public interface AdministrateurService {
    ManagerGlobalResponse createManagerGlobal(CreateManagerGlobalRequest request, JwtClaims caller);
    List<ManagerGlobalResponse> listAllManagersGlobal(JwtClaims caller);
    void deleteManagerGlobal(UUID managerId, JwtClaims caller);
}