package com.njila.njila_payement_service.domain.enumerations;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

@RequiredArgsConstructor

@Getter

public enum TransactionStatus {

    AUTHORIZED("AUTHORIZED"),
    CAPTURED("SUCCESSFUL"),
    INITIATED("PENDING"),
    FAILED("FAILED"),
    PARTIALLY_REFUNDED("PARTIALLY_REFUNDED"),
    REVERSED("REVERSED"),
    TIMEOUT("TIMEOUT"),;

    private final String value;

    public static TransactionStatus fromValue(String value) {
        for (TransactionStatus transactionStatus : TransactionStatus.values()) {
            if (transactionStatus.value.equals(value)) {
                return transactionStatus;
            }
        }
        throw new IllegalArgumentException("Invalid status: " + value);
    }
}
