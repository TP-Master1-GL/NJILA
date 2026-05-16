package com.njila.njila_payement_service.infrastructure.messaging.interfaces;

import java.util.Map;

public interface PaymentEventListener {
    void handleBookingCreated(Map<String, Object> payload);
    void handleRefundRequested(Map<String, Object> payload);
}
