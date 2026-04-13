package com.njila.njila_payement_service.domain.exceptions;

public class InvalidIdempotencyKeyException extends RuntimeException {

    public InvalidIdempotencyKeyException(String message) {
        super(message);
    }
}
