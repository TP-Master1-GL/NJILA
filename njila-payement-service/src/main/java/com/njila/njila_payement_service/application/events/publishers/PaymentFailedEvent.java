package com.njila.njila_payement_service.application.events.publishers;

import java.time.LocalDateTime;

public class PaymentFailedEvent {

    private int paymentId;

    private int reservationId;

    private int passengerId;

    private String reason;

    private LocalDateTime failedAt;
}
