package com.njila.njila_payement_service.infrastructure.messaging.implementations;

import com.njila.njila_payement_service.application.dtos.requests.InitiatePaymentRequest;
import com.njila.njila_payement_service.application.dtos.requests.RefundPaymentRequest;
import com.njila.njila_payement_service.application.dtos.responses.InitiatePaymentResponse;
import com.njila.njila_payement_service.application.services.interfaces.PaymentService;
import com.njila.njila_payement_service.domain.enumerations.Currency;
import com.njila.njila_payement_service.domain.enumerations.PaymentMethodType;
import com.njila.njila_payement_service.domain.enumerations.PaymentStatus;
import com.njila.njila_payement_service.infrastructure.config.RabbitMqConfig;
import com.njila.njila_payement_service.infrastructure.messaging.interfaces.PaymentEventListener;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class PaymentEventListenerImpl implements PaymentEventListener {

    private final PaymentService paymentService;

    // ─────────────────────────────────────────────────────────────────────────
    // booking.created → initier + traiter le paiement
    // ─────────────────────────────────────────────────────────────────────────

    @RabbitListener(queues = RabbitMqConfig.BOOKING_CREATED_QUEUE)
    @Override
    public void handleBookingCreated(Map<String, Object> payload) {
        log.info("[MQ] booking.created reçu : {}", payload);
        try {
            long   bookingId        = extractLong(payload,   "bookingId");
            double amount           = extractDouble(payload,  "amount");
            String passengerId      = extractString(payload,  "passengerId", "");
            String phoneNumber      = extractString(payload,  "phoneNumber", "");
            String currencyStr      = extractString(payload,  "currency",    "XAF");
            String paymentMethodStr = extractString(payload,  "paymentMethodType", "MOBILE_MONEY");

            Currency          currency    = parseCurrency(currencyStr);
            PaymentMethodType methodType  = parsePaymentMethod(paymentMethodStr);

            InitiatePaymentRequest request = new InitiatePaymentRequest(
                    bookingId, passengerId, amount, currency, phoneNumber, methodType
            );

            // initiatePayment est désormais idempotent : retourne l'existant si déjà créé
            InitiatePaymentResponse response = paymentService.initiatePayment(request);
            log.info("[MQ] Paiement initié/récupéré — paymentId={} bookingId={}",
                    response.paymentId(), bookingId);

            // Ne lancer processPayment que si le paiement est encore PENDING
            // Évite de re-déclencher un appel Campay sur un paiement déjà en cours
            PaymentStatus currentStatus =
                    paymentService.getPaymentStatusById(response.paymentId());

            if (currentStatus == PaymentStatus.PENDING) {
                paymentService.processPayment(response.paymentId());
            } else {
                log.info("[MQ] processPayment ignoré — statut={} paymentId={}",
                        currentStatus, response.paymentId());
            }

        } catch (Exception e) {
            // ⚠️ On log l'erreur mais on NE RE-THROW PAS
            // → RabbitMQ acquitte le message et n'entre pas en boucle infinie
            // → Les erreurs légitimes iront en DLQ si configurée (voir RabbitMqConfig)
            log.error("[MQ] Erreur non récupérable booking.created : {}", e.getMessage(), e);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // booking.refund.requested → rembourser
    // ─────────────────────────────────────────────────────────────────────────

    @RabbitListener(queues = RabbitMqConfig.BOOKING_REFUND_REQUESTED_QUEUE)
    @Override
    public void handleRefundRequested(Map<String, Object> payload) {
        log.info("[MQ] booking.refund.requested reçu : {}", payload);
        try {
            RefundPaymentRequest request = new RefundPaymentRequest(
                    extractLong(payload,   "bookingId"),
                    extractString(payload, "passengerId", ""),
                    extractDouble(payload, "amount"),
                    extractString(payload, "currency",    "XAF"),
                    extractString(payload, "motif",       "")
            );
            paymentService.processRefund(request);

        } catch (Exception e) {
            // Même principe : on log sans re-throw pour éviter la boucle infinie
            log.error("[MQ] Erreur non récupérable booking.refund.requested : {}",
                    e.getMessage(), e);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────────────────────────────────

    private long extractLong(Map<String, Object> payload, String key) {
        Object val = payload.get(key);
        if (val == null) throw new IllegalArgumentException(
                "Champ obligatoire absent : " + key);
        return Long.parseLong(val.toString());
    }

    private double extractDouble(Map<String, Object> payload, String key) {
        Object val = payload.get(key);
        if (val == null) throw new IllegalArgumentException(
                "Champ obligatoire absent : " + key);
        return Double.parseDouble(val.toString());
    }

    private String extractString(Map<String, Object> payload, String key, String def) {
        Object val = payload.get(key);
        return (val != null && !val.toString().isBlank()) ? val.toString() : def;
    }

    private Currency parseCurrency(String val) {
        try {
            return Currency.valueOf(val.toUpperCase().trim());
        } catch (IllegalArgumentException e) {
            log.warn("[MQ] Devise '{}' inconnue — fallback XAF", val);
            return Currency.XAF;
        }
    }

    private PaymentMethodType parsePaymentMethod(String val) {
        try {
            return PaymentMethodType.valueOf(
                    val.toUpperCase().trim().replace(" ", "_"));
        } catch (IllegalArgumentException e) {
            log.warn("[MQ] PaymentMethodType '{}' inconnu — fallback MOBILE_MONEY", val);
            return PaymentMethodType.MOBILE_MONEY;
        }
    }
}
