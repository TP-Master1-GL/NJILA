package com.njila.njila_payement_service.infrastructure.messaging.implementations;

import com.njila.njila_payement_service.application.dtos.requests.InitiatePaymentRequest;
import com.njila.njila_payement_service.application.dtos.responses.InitiatePaymentResponse;
import com.njila.njila_payement_service.application.events.consumers.BookingCreatedEvent;

import com.njila.njila_payement_service.application.services.interfaces.PaymentService;

import com.njila.njila_payement_service.infrastructure.config.RabbitMqConfig;
import com.njila.njila_payement_service.infrastructure.messaging.interfaces.PaymentEventListener;
import lombok.RequiredArgsConstructor;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Service;



@Service

@RequiredArgsConstructor

public class PaymentEventListenerImpl implements PaymentEventListener {

    private final PaymentService paymentService;

    @RabbitListener(queues = RabbitMqConfig.BOOKING_CREATED_QUEUE)
    @Override
    public void handle(BookingCreatedEvent event) {

        System.out.println("Received BookingCreatedEvent");

        InitiatePaymentRequest initiatePaymentRequest = new InitiatePaymentRequest(
                event.getBookingId(),
                event.getPassengerId(),
                event.getAmount(),
                event.getCurrency(),
                event.getPhoneNumber(),
                event.getPaymentMethodType()
        );

        InitiatePaymentResponse response = paymentService.initiatePayment(initiatePaymentRequest);

       paymentService.processPayment(response.paymentId());
    }
}
