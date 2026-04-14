package com.njila.njila_payement_service.infrastructure.adapters.campay.CamDtos.responses;

import lombok.Getter;
import lombok.Setter;

import java.util.UUID;

@Getter

@Setter

public class WithdrawResponse {

    private UUID reference;

    private String status;

}
