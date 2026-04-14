package com.njila.njila_payement_service.application.callbackPayload;

import com.njila.njila_payement_service.domain.enumerations.Currency;

import java.util.UUID;

public interface CallbackPayload {

    String getStatus();

    UUID getReference();

    Integer getAmount();

    Currency getCurrency();

    String getOperator();

    //CampayReference
    String getCode();

    String getSignature();

    UUID ExternalReference();

    String getPhoneNumber();

    boolean verifySignature();


}
