package com.njila.njila_payement_service.infrastructure.adapters.campay.CamDtos.requests;


import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter

@Setter

@AllArgsConstructor

@NoArgsConstructor

public class WithdrawRequest {

    private String amount;

    private String to;

    private String description;

    private String external_reference;
}
