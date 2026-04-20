package com.njila.njila_payement_service.application.events.publishers;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter

@AllArgsConstructor
@NoArgsConstructor
public class PaymentFailedEvent {

    private long paymentId;

    private long bookingId;

    private long passengerId;

    private String reason;

    private LocalDateTime failedAt;
}
