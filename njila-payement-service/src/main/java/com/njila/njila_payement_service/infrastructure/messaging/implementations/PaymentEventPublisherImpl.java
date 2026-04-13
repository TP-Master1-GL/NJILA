package com.njila.njila_payement_service.infrastructure.messaging.implementations;


import com.njila.njila_payement_service.application.events.publishers.*;
import com.njila.njila_payement_service.infrastructure.config.RabbitMqConfig;
import com.njila.njila_payement_service.infrastructure.messaging.interfaces.PaymentEventPublisher;
import lombok.RequiredArgsConstructor;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service

@RequiredArgsConstructor(onConstructor_ = @Autowired)

public class PaymentEventPublisherImpl implements PaymentEventPublisher {

    private final RabbitTemplate rabbitTemplate;


    @Override
    public void publishPaymentCompleted(PaymentCompletedEvent completedEvent) {

        rabbitTemplate.convertAndSend(
                RabbitMqConfig.EXCHANGE,
                RabbitMqConfig.PAYMENT_COMPLETED,
                completedEvent
        );
    }

    @Override
    public void publishPaymentFailed(PaymentFailedEvent failedEvent) {
        rabbitTemplate.convertAndSend(
                RabbitMqConfig.EXCHANGE,
                RabbitMqConfig.PAYMENT_FAILED,
                failedEvent
                );
    }

    @Override
    public void publishPaymentRefunded(PaymentRefundedEvent refundedEvent) {
        rabbitTemplate.convertAndSend(
                RabbitMqConfig.EXCHANGE,
                RabbitMqConfig.PAYMENT_REFUNDED,
                refundedEvent
        );

    }

    @Override
    public void publishPaymentCancelled(PaymentCancelledEvent cancelledEvent) {
        rabbitTemplate.convertAndSend(
                RabbitMqConfig.EXCHANGE,
                RabbitMqConfig.PAYMENT_CANCELLED,
                cancelledEvent
        );
    }

    @Override
    public void publishPaymentTimeout(PaymentTimeoutEvent timeoutEvent) {
        rabbitTemplate.convertAndSend(
                RabbitMqConfig.EXCHANGE,
                RabbitMqConfig.PAYMENT_TIMEOUT,
                timeoutEvent
        );
    }


    @Override
    public void publishPaymentInitiated(PaymentInitiatedEvent initiatedEvent) {
        rabbitTemplate.convertAndSend(
                RabbitMqConfig.EXCHANGE,
                RabbitMqConfig.PAYMENT_INITIATED,
                initiatedEvent
        );
    }
}
