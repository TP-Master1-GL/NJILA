package com.njila.njila_payement_service.application.events.publishers;

import com.njila.njila_payement_service.domain.enumerations.Currency;


import java.math.BigDecimal;
import java.time.LocalDate;

public class PaymentCompletedEvent {

    private int paymentId;

    private int reservationId;

    private int passengerId;

    private BigDecimal amount;

    private Currency currency;

    private LocalDate completedAt;
}
