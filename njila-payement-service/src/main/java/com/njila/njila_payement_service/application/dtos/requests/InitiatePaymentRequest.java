package com.njila.njila_payement_service.application.dtos.requests;

import com.njila.njila_payement_service.domain.enumerations.Currency;
import com.njila.njila_payement_service.domain.enumerations.PaymentMethodType;

public record InitiatePaymentRequest(
        long bookingId,
        String passengerId,        // ← String au lieu de long
        double amount,
        Currency currency,
        String phoneNumber,
        PaymentMethodType paymentMethodType
) {}
