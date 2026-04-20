package com.njila.njila_payement_service.application.dtos.responses;

import com.njila.njila_payement_service.domain.enumerations.Currency;
import com.njila.njila_payement_service.domain.enumerations.PaymentMethodType;
import com.njila.njila_payement_service.domain.enumerations.PaymentStatus;
import lombok.Builder;


@Builder

public record InitiatePaymentResponse (

        long paymentId,

        double amount,

        PaymentStatus status,

        PaymentMethodType paymentMethodType,

        Currency currency
){}
