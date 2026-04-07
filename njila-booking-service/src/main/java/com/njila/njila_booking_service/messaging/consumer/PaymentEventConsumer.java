package com.njila.njila_booking_service.messaging.consumer;

import com.njila.njila_booking_service.config.RabbitMQConfig;
import com.njila.njila_booking_service.service.ReservationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;
import java.util.Map;

@Component
@RequiredArgsConstructor
@Slf4j
public class PaymentEventConsumer {

    private final ReservationService reservationService;

    // Paiement confirmé → confirmer réservation + générer billet
    @RabbitListener(queues = RabbitMQConfig.PAYMENT_SUCCESS_QUEUE)
    public void onPaymentConfirmed(Map<String, Object> payload) {
        log.info("[MQ] payment.confirmed reçu : {}", payload);
        Long bookingId       = Long.valueOf(payload.get("bookingId").toString());
        String transactionId = payload.get("transactionId").toString();
        reservationService.confirmerApresPaiement(bookingId, transactionId);
    }

    // Paiement échoué → libérer verrou + annuler réservation
    @RabbitListener(queues = RabbitMQConfig.PAYMENT_FAILED_QUEUE)
    public void onPaymentFailed(Map<String, Object> payload) {
        log.info("[MQ] payment.failed reçu : {}", payload);
        Long bookingId = Long.valueOf(payload.get("bookingId").toString());
        reservationService.annulerApresEchecPaiement(bookingId);
    }
}