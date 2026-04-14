package com.njila.njila_payement_service.domain.exceptions;

public class InvalidTransactionTransitionException extends RuntimeException {
    public InvalidTransactionTransitionException(String message) {
        super(message);
    }
}
