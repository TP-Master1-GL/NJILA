package com.njila.njila_payement_service.domain.enumerations;

public enum TransactionStatus {
    AUTHORIZED,
    CAPTURED,
    INITIATED,
    FAILED,
    PARTIALLY_REFUNDED,
    REVERSED,
    TIMEOUT
}
