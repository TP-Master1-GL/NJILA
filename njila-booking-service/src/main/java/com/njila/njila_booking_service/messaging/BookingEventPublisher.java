package com.njila.njila_booking_service.messaging;

import com.njila.njila_booking_service.config.RabbitMQConfig;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
@RequiredArgsConstructor
@Slf4j
public class BookingEventPublisher {

    private final RabbitTemplate rabbitTemplate;

    public void publishBookingCreated(Map<String, Object> payload) {
        rabbitTemplate.convertAndSend(
            RabbitMQConfig.BOOKING_EXCHANGE,
            RabbitMQConfig.BOOKING_CREATED,
            payload
        );
        log.info("[BOOKING] Publie booking.created : reservationId={}", payload.get("reservationId"));
    }

    public void publishBookingConfirmed(Map<String, Object> payload) {
        rabbitTemplate.convertAndSend(
            RabbitMQConfig.BOOKING_EXCHANGE,
            RabbitMQConfig.BOOKING_CONFIRMED,
            payload
        );
        log.info("[BOOKING] Publie booking.confirmed : reservationId={}", payload.get("reservationId"));
    }

    public void publishBookingCancelled(Map<String, Object> payload) {
        rabbitTemplate.convertAndSend(
            RabbitMQConfig.BOOKING_EXCHANGE,
            RabbitMQConfig.BOOKING_CANCELLED,
            payload
        );
        log.info("[BOOKING] Publie booking.cancelled : reservationId={}", payload.get("reservationId"));
    }
}
