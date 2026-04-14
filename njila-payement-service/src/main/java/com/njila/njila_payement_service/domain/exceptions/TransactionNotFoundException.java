package com.njila.njila_payement_service.domain.exceptions;

public class TransactionNotFoundException extends RuntimeException {

    public TransactionNotFoundException(String message) {

        super(message);
    }
}
