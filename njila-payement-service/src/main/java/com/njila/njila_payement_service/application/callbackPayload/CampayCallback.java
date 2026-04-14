package com.njila.njila_payement_service.application.callbackPayload;

import com.njila.njila_payement_service.domain.enumerations.Currency;

import java.util.UUID;

public class CampayCallback implements CallbackPayload {

    private String status;

    private UUID reference;

    private Integer amount;

    private Currency currency;

    private String operator;

    private String code;

    private String signature;

    private UUID externalReference;

    private String phoneNumber;

    @Override
    public String getStatus() {

        return status;
    }

    @Override
    public UUID getReference() {

        return reference;
    }

    @Override
    public Integer getAmount() {

        return amount;
    }

    @Override
    public Currency getCurrency()
    {
        return currency;
    }

    @Override
    public String   getOperator() {
        return operator;
    }

    @Override
    public String getCode() {

        return code;
    }

    @Override
    public String getSignature() {

        return signature;
    }

    @Override
    public UUID ExternalReference() {

        return externalReference;
    }

    @Override
    public String getPhoneNumber() {

        return phoneNumber;
    }

    @Override
    public boolean verifySignature() {

        return true;
    }

}
