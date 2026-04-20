package com.njila.njila_payement_service.infrastructure.messaging.interfaces;

import com.njila.njila_payement_service.application.events.publishers.*;

public interface PaymentEventPublisher {

    void publishPaymentCompleted(PaymentCompletedEvent completedEvent);

    void publishPaymentFailed(PaymentFailedEvent failedEvent);

    void publishPaymentRefunded(PaymentRefundedEvent refundedEvent);

    void publishPaymentCancelled(PaymentCancelledEvent cancelledEvent);

    void publishPaymentTimeout(PaymentTimeoutEvent timeoutEvent);

    void publishPaymentInitiated(PaymentInitiatedEvent initiatedEvent);
}
