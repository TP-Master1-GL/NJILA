package com.njila.njila_payement_service.infrastructure.adapters.campay.CamDtos.responses;

import lombok.Getter;
import lombok.Setter;

@Getter

@Setter

public class TokenResponse {

    private String token;

    private Integer expiresIn;

}
