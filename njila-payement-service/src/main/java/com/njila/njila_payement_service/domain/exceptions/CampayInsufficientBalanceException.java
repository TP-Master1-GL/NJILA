package com.njila.njila_payement_service.domain.exceptions;

public class CampayInsufficientBalanceException extends CamPayException {

    public CampayInsufficientBalanceException(String message) {

        super(message);
    }
}
