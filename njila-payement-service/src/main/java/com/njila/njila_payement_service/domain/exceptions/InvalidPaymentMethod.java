package com.njila.njila_payement_service.domain.exceptions;

public class InvalidPaymentMethod extends RuntimeException {

    public InvalidPaymentMethod(String message) {
        super(message);
    }
}
