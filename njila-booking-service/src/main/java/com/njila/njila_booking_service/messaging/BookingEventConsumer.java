package com.njila.njila_booking_service.messaging;

import com.njila.njila_booking_service.config.RabbitMQConfig;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
@RequiredArgsConstructor
@Slf4j
public class BookingEventConsumer {

    @RabbitListener(queues = RabbitMQConfig.PAYMENT_SUCCESS_QUEUE)
    public void onPaymentSuccess(Map<String, Object> event) {
        Long reservationId = Long.valueOf(event.get("reservationId").toString());
        log.info("[BOOKING] payment.success recu → confirmation reservationId={}", reservationId);
        // TODO Nguembu : bookingService.confirmBooking(reservationId);
    }

    @RabbitListener(queues = RabbitMQConfig.PAYMENT_FAILED_QUEUE)
    public void onPaymentFailed(Map<String, Object> event) {
        Long reservationId = Long.valueOf(event.get("reservationId").toString());
        log.warn("[BOOKING] payment.failed recu → annulation reservationId={}", reservationId);
        // TODO Nguembu : bookingService.cancelBooking(reservationId);
    }

    @RabbitListener(queues = RabbitMQConfig.FLEET_BREAKDOWN_QUEUE)
    public void onBusBreakdown(Map<String, Object> event) {
        Long busId = Long.valueOf(event.get("busId").toString());
        log.warn("[BOOKING] fleet.bus.breakdown recu → annulation voyages busId={}", busId);
        // TODO Nguembu : bookingService.cancelBookingsByBus(busId);
    }
}
