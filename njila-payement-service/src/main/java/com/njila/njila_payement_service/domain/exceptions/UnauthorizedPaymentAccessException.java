package com.njila.njila_payement_service.domain.exceptions;

public class UnauthorizedPaymentAccessException extends RuntimeException {

    public UnauthorizedPaymentAccessException(String message) {
        super(message);
    }
}
