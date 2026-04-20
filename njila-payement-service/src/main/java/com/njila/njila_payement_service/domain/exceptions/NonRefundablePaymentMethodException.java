package com.njila.njila_payement_service.domain.exceptions;

public class NonRefundablePaymentMethodException extends RuntimeException {

    public NonRefundablePaymentMethodException(String message) {

        super(message);
    }
}
