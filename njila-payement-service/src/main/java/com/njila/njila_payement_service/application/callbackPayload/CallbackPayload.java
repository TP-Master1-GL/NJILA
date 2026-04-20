package com.njila.njila_payement_service.application.callbackPayload;

import com.njila.njila_payement_service.domain.enumerations.Currency;

import java.util.UUID;

public interface CallbackPayload {

    String getStatus();

    String  getReference();

    Double getAmount();

    Currency getCurrency();

    String getOperator();

    //CampayReference
    String getCode();

    String getSignature();

    String  ExternalReference();

    String getPhoneNumber();

    boolean verifySignature();


}
