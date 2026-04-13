package com.njila.njila_payement_service.domain.exceptions;

public class UnsupportedPaymentMethodException extends RuntimeException {

    public UnsupportedPaymentMethodException(String message) {
        super(message);
    }
}
