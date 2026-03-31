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

    // ─── Déclenche le paiement après création réservation ─────────────────────

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

    // ─── Notifie notification-service après génération du billet ──────────────

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
        log.info("[MQ] ticket.generated publié → userId={} ticket={}",
                userId, numeroTicket);
    }

    // ─── CORRECTION UC-B4 : Initier un remboursement après annulation ─────────
    //
    // Postcondition S6 UC-B4 : "Remboursement initié"
    // Le payment-service écoute booking.refund.requested pour exécuter
    // le remboursement via l'opérateur (MTN Money, Orange Money…).

    public void publierRemboursementDemande(Long bookingId, Long voyageurId,
                                            Double montant, String motif) {
        Map<String, Object> payload = Map.of(
                "bookingId",  bookingId,
                "voyageurId", voyageurId,
                "montant",    montant,
                "motif",      motif
        );
        rabbitTemplate.convertAndSend(
                RabbitMQConfig.BOOKING_EXCHANGE,
                RabbitMQConfig.BOOKING_REFUND_REQUESTED_KEY,
                payload
        );
        log.info("[MQ] booking.refund.requested publié → bookingId={} montant={}",
                bookingId, montant);
    }

    // ─── NOUVEAU UC-B7 : Notifier la clôture d'un départ ─────────────────────
    //
    // Après que le manager local a validé tous les billets et verrouillé le
    // voyage, un événement est émis pour que fleet-service marque le voyage
    // comme "PARTI" et que notification-service envoie un récapitulatif.

    public void publierDepartVoyage(Long voyageId, Long idManager,
                                    int passagersEmbarques, int placesTotales) {
        Map<String, Object> payload = Map.of(
                "voyageId",           voyageId,
                "idManager",          idManager,
                "passagersEmbarques", passagersEmbarques,
                "placesTotales",      placesTotales
        );
        rabbitTemplate.convertAndSend(
                RabbitMQConfig.BOOKING_EXCHANGE,
                RabbitMQConfig.BOOKING_DEPART_KEY,
                payload
        );
        log.info("[MQ] booking.depart publié → voyageId={} passagers={}/{}",
                voyageId, passagersEmbarques, placesTotales);
        }
}