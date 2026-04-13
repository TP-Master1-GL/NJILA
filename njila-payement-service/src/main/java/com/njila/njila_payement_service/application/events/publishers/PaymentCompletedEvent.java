package com.njila.njila_payement_service.application.events.publishers;

import com.njila.njila_payement_service.domain.enumerations.Currency;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;


import java.time.LocalDateTime;

@Getter
@Setter

@AllArgsConstructor
@NoArgsConstructor

public class PaymentCompletedEvent {

    private long paymentId;

    private long bookingId;

    private long passengerId;

    private double amount;

    private Currency currency;

    private LocalDateTime completedAt;
}
