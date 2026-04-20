package com.njila.njila_payement_service.application.callbackPayload;

import com.njila.njila_payement_service.domain.enumerations.Currency;
import org.springframework.beans.factory.annotation.Value;

import java.util.UUID;

public class CampayCallback implements CallbackPayload {

    private String status;

    private String reference;

    private Integer amount;

    private Currency currency;

    private String operator;

    private String code;

    private String signature;

    private String operatorReference;

    private String endpoint;

    private String externalReference;

    private String phoneNumber;

    @Value("${campay.webhook.key}")
    private String webhookKey;

    @Override
    public String getStatus() {

        return status;
    }

    @Override
    public String getReference() {

        return reference;
    }

    @Override
    public Double getAmount() {

        return amount != null ? amount.doubleValue() : null;
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
    public String ExternalReference() {

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
