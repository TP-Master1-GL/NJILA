package com.njila.njila_payement_service.application.events.publishers;

import com.njila.njila_payement_service.domain.enumerations.Currency;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;


import java.time.LocalDate;

@Getter
@Setter

@AllArgsConstructor
@NoArgsConstructor


public class PaymentRefundedEvent {
    private long bookingId;

    private long passengerId;

    private long paymentId;

    private double refundedAmount;

    private Currency currency;

    private LocalDate refundedAt;
}
