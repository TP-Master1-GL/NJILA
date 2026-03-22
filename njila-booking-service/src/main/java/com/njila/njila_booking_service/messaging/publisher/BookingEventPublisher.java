package com.njila.njila_booking_service.messaging.publisher;

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

    // Déclenche le paiement après création réservation
    public void publierBookingCreated(Long bookingId, Double montant,
            Long voyageurId, Long voyageId) {
        Map<String, Object> payload = Map.of(
                "bookingId",  bookingId,
                "montant",    montant,
                "voyageurId", voyageurId,
                "voyageId",   voyageId
        );
        rabbitTemplate.convertAndSend(
                RabbitMQConfig.BOOKING_EXCHANGE,
                RabbitMQConfig.BOOKING_CREATED_KEY,
                payload
        );
        log.info("[MQ] booking.created publié → bookingId={}", bookingId);
    }

    // Notifie notification-service après génération du billet
    public void publierTicketGenerated(Long userId, String email,
                                    String billetPdfUrl, String numeroTicket,
                                    String origine, String destination,
                                    String dateDepart) {
        Map<String, Object> payload = Map.of(
                "userId",       userId,
                "email",        email,
                "billetPdfUrl", billetPdfUrl,
                "numeroTicket", numeroTicket,
                "origine",      origine,
                "destination",  destination,
                "dateDepart",   dateDepart
        );
        rabbitTemplate.convertAndSend(
                RabbitMQConfig.BOOKING_EXCHANGE,
                RabbitMQConfig.TICKET_GENERATED_KEY,
                payload
        );
        log.info("[MQ] ticket.generated publié → userId={} ticket={}", userId, numeroTicket);
    }
}