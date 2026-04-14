package com.njila.njila_payement_service.infrastructure.adapters.campay.CamDtos.requests;

import com.njila.njila_payement_service.domain.enumerations.Currency;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter

@Setter

@AllArgsConstructor

@NoArgsConstructor

public class CollectRequest {

    private String  amount;

    private String currency;

    private String phoneNumber;

    private String description;

    private String externalReference;

}
