package com.njila.njila_payement_service.infrastructure.messaging.interfaces;

import com.njila.njila_payement_service.application.events.consumers.BookingCreatedEvent;

public interface PaymentEventListener {

    void handle(BookingCreatedEvent event);
}
