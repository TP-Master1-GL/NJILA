package com.njila.njila_payement_service.application.events.consumers;

import com.njila.njila_payement_service.domain.enumerations.Currency;
import com.njila.njila_payement_service.domain.enumerations.PaymentMethodType;

import java.math.BigDecimal;

public class PaymentInitiatedEvent {

    private int reservationId;

    private int passengerId;

    private BigDecimal amount;

    private Currency currency;

    private PaymentMethodType paymentMethodType;

    private String phoneNumber;
}
