package com.njila.njila_payement_service.domain.exceptions;

public class ExistingPaymentException extends RuntimeException {

    public ExistingPaymentException(String message) {

        super(message);
    }
}
