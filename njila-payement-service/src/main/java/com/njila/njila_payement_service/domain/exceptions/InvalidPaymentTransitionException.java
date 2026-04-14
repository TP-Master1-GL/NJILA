package com.njila.njila_payement_service.domain.exceptions;

public class InvalidPaymentTransitionException extends RuntimeException {

    public InvalidPaymentTransitionException(String message) {
        super(message);
    }
}
