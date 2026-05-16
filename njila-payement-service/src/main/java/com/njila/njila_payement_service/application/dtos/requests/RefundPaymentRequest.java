package com.njila.njila_payement_service.application.dtos.requests;

public record RefundPaymentRequest(
        Long   bookingId,
        String passengerId,
        Double amount,
        String currency,
        String motif
) {}
