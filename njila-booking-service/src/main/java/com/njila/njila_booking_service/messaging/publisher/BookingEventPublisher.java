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

    public void publierBookingCreated(Long bookingId, Double montant, String devise,
                                      String voyageurId, String voyageId,
                                      String telephoneVoyageur, String paymentMethodType,
                                      String operateurPaiement) {
        Map<String, Object> payload = Map.of(
                "bookingId",         bookingId,
                "amount",            montant,
                "currency",          devise != null ? devise : "XAF",
                "passengerId",       voyageurId,
                "voyageId",          voyageId,
                // ✅ Normalisation : supprime le '+' si présent → +237XXXXXXX → 237XXXXXXX
                "phoneNumber",       normaliserTelephone(telephoneVoyageur),
                "paymentMethodType", paymentMethodType != null ? paymentMethodType : "MOBILE_MONEY",
                "operateurPaiement", operateurPaiement != null ? operateurPaiement : "ORANGE_MONEY"
        );
        rabbitTemplate.convertAndSend(
                RabbitMQConfig.PAYMENT_EXCHANGE,
                RabbitMQConfig.BOOKING_CREATED_KEY,
                payload
        );
        log.info("[MQ] booking.created publié sur payment.exchange → bookingId={}", bookingId);
    }

    public void publierTicketGenerated(String userId, String email,
                                       String billetPdfBase64, String numeroTicket,
                                       String origine, String destination,
                                       String dateDepart) {
        Map<String, Object> payload = Map.of(
                "userId",          userId,
                "email",           email != null ? email : "",
                "billetPdfBase64", billetPdfBase64 != null ? billetPdfBase64 : "",
                "numeroTicket",    numeroTicket,
                "origine",         origine,
                "destination",     destination,
                "dateDepart",      dateDepart
        );
        rabbitTemplate.convertAndSend(
                RabbitMQConfig.BOOKING_EXCHANGE,
                RabbitMQConfig.TICKET_GENERATED_KEY,
                payload
        );
        log.info("[MQ] ticket.generated publié → userId={} ticket={}", userId, numeroTicket);
    }

    public void publierRemboursementDemande(Long bookingId, String voyageurId,
                                            Double montant, String devise, String motif) {
        Map<String, Object> payload = Map.of(
                "bookingId",   bookingId,
                "passengerId", voyageurId,
                "amount",      montant,
                "currency",    devise != null ? devise : "XAF",
                "motif",       motif != null ? motif : ""
        );
        rabbitTemplate.convertAndSend(
                RabbitMQConfig.PAYMENT_EXCHANGE,
                RabbitMQConfig.BOOKING_REFUND_REQUESTED_KEY,
                payload
        );
        log.info("[MQ] booking.refund.requested publié → bookingId={} montant={}",
                bookingId, montant);
    }

    public void publierDepartVoyage(String voyageId, String idManager,
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

    // ─────────────────────────────────────────────────────────────────────────
    // HELPER — Normalisation du numéro de téléphone
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Supprime le '+' initial si présent.
     * +237657098574 → 237657098574  ✅ accepté par CamPay/payment-service
     *  237657098574 → 237657098574  ✅ inchangé
     *  null / ""    → ""            ✅ géré sans NPE
     */
    private String normaliserTelephone(String telephone) {
        if (telephone == null || telephone.isBlank()) return "";
        return telephone.startsWith("+") ? telephone.substring(1) : telephone;
    }
}
