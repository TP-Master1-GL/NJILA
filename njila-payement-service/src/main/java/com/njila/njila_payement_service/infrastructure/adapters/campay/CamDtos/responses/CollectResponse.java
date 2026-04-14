package com.njila.njila_payement_service.infrastructure.adapters.campay.CamDtos.responses;

import lombok.Getter;
import lombok.Setter;

@Getter

@Setter

public class CollectResponse {

    private String reference;

    private String ussdCode;

    private String operator; // MTN ou Orange

}
