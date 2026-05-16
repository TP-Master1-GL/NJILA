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

    // ─── payment.succeed → confirmer réservation + générer billet ────────────
    @RabbitListener(queues = RabbitMQConfig.PAYMENT_SUCCESS_QUEUE)
    public void onPaymentConfirmed(Map<String, Object> payload) {
        log.info("[MQ] payment.succeed reçu : {}", payload);
        try {
            Object rawBookingId = payload.get("bookingId");
            if (rawBookingId == null) {
                log.error("[MQ] payment.succeed : champ 'bookingId' absent — payload={}", payload);
                return;
            }
            Long bookingId = Long.valueOf(rawBookingId.toString());

            Object rawTx = payload.getOrDefault("transactionId",
                    payload.getOrDefault("paymentId", "UNKNOWN"));
            String transactionId = rawTx.toString();

            reservationService.confirmerApresPaiement(bookingId, transactionId);

        } catch (Exception e) {
            log.error("[MQ] Erreur traitement payment.succeed : {}", e.getMessage(), e);
            throw e; // re-throw → DLQ si configurée
        }
    }

    // ─── payment.failed → supprimer réservation + libérer siège ─────────────
    //
    // Contrairement à une annulation utilisateur, un échec de paiement
    // signifie que la réservation n'a jamais abouti : on la supprime
    // physiquement de la BDD (pas de remboursement à déclencher).
    @RabbitListener(queues = RabbitMQConfig.PAYMENT_FAILED_QUEUE)
    public void onPaymentFailed(Map<String, Object> payload) {
        log.info("[MQ] payment.failed reçu : {}", payload);
        try {
            Object rawBookingId = payload.get("bookingId");
            if (rawBookingId == null) {
                log.error("[MQ] payment.failed : champ 'bookingId' absent — payload={}", payload);
                return;
            }
            Long bookingId = Long.valueOf(rawBookingId.toString());

            String motif = payload.getOrDefault("motif", "Échec paiement").toString();
            reservationService.supprimerApresEchecPaiement(bookingId, motif);

        } catch (Exception e) {
            log.error("[MQ] Erreur traitement payment.failed : {}", e.getMessage(), e);
            throw e;
        }
    }
}
