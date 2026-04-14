package com.njila.njila_payement_service.infrastructure.adapters.campay.CamDtos.responses;

import com.njila.njila_payement_service.domain.enumerations.Currency;
import lombok.Getter;
import lombok.Setter;

@Getter

@Setter

public class TransactionStatusResponse {

    private String reference;

    private String status;

    private double amount;

    private Currency currency;

    private String operator;

    private String code;

    private String phoneNumber;

    private String externalReference;
}
