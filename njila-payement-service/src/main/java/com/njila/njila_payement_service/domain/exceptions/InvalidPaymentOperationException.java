package com.njila.njila_payement_service.domain.exceptions;

public class InvalidPaymentOperationException extends RuntimeException {

    public InvalidPaymentOperationException(String message) {
        super(message);
    }
}
