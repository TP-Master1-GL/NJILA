package com.njila.njila_payement_service.domain.exceptions;

public class InvalidAmountException extends RuntimeException {

    public InvalidAmountException(String message) {

        super(message);
    }
}
