package com.njila.njila_payement_service.domain.enumerations;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

@RequiredArgsConstructor
@Getter
public enum PaymentStatus {
    CANCELLED("CANCELLED"),
    COMPLETED("COMPLETED"),
    EXPIRED("EXPIRED"),
    FAILED("FAILED"),
    PARTIALLY_REFUNDED("PARTIALLY_REFUNDED"),
    PENDING("PENDING"),
    PROCESSING("PROCESSING"),
    REFUNDED("REFUNDED"),;

    private final String value;

    public static PaymentStatus fromValue(String value) {
        for (PaymentStatus paymentStatus : PaymentStatus.values()) {
            if (paymentStatus.value.equals(value)) {
                return paymentStatus;
            }
        }
        throw new IllegalArgumentException("Invalid status: " + value);
    }
}
