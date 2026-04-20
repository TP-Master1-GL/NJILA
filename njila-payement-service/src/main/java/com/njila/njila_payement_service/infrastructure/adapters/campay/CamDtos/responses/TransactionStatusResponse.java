package com.njila.njila_payement_service.infrastructure.adapters.campay.CamDtos.responses;

import com.njila.njila_payement_service.domain.enumerations.Currency;
import lombok.Getter;
import lombok.Setter;

@Getter

@Setter

public class TransactionStatusResponse {

    private String reference;

    private String external_reference;

    private String status;

    private String amount;

    private Currency currency;

    private String operator;

    private String code;

    private String operator_reference;

    private String description;

    private String external_user;

    private String reason;

    private String phoneNumber;

    private String endpoint;
}
