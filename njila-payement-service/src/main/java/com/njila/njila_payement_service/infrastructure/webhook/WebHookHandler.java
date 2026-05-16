package com.njila.njila_payement_service.infrastructure.webhook;

import com.njila.njila_payement_service.application.services.interfaces.PaymentService;
import com.njila.njila_payement_service.application.services.interfaces.IdempotencyService;
import com.njila.njila_payement_service.domain.valueObjects.IdempotencyKey;
import com.njila.njila_payement_service.infrastructure.repositories.TransactionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
@RequiredArgsConstructor
@Slf4j
public class WebHookHandler {

    private final PaymentService   paymentService;
    private final IdempotencyService    idempotencyService;
    private final TransactionRepository transactionRepository;

    /**
     * Point d'entrée unique pour traiter un callback Campay.
     * Appelé depuis CampayCallbackController.
     *
     * Payload Campay attendu :
     * {
     *   "reference"  : "CAMP-XXXX",   ← référence Campay de la transaction
     *   "status"     : "SUCCESSFUL" | "FAILED" | "PENDING",
     *   "amount"     : "5000",
     *   "currency"   : "XAF",
     *   "operator"   : "MTN",
     *   "code"       : "...",
     *   "signature"  : "..."
     * }
     */
    public void handle(Map<String, Object> payload) {

        log.info("[WEBHOOK] Campay callback reçu : {}", payload);

        String reference = extractString(payload, "reference");
        String status    = extractString(payload, "status");

        if (reference == null || reference.isBlank()) {
            log.error("[WEBHOOK] Champ 'reference' absent — payload ignoré : {}", payload);
            return;
        }

        // Idempotence : éviter de traiter deux fois le même callback
        IdempotencyKey idempotencyKey = IdempotencyKey.of("webhook_" + reference);
        if (!idempotencyService.checkAndStore(idempotencyKey)) {
            log.warn("[WEBHOOK] Callback déjà traité — reference={} (doublon ignoré)", reference);
            return;
        }

        // Retrouver le paymentId via la référence Campay stockée en transaction
        transactionRepository.findByProvidedReference(reference).ifPresentOrElse(
            transaction -> {
                long paymentId = transaction.getPayment().getPaymentId();

                log.info("[WEBHOOK] reference={} → paymentId={} campayStatus={}",
                        reference, paymentId, status);

                switch (status != null ? status : "") {

                    case "SUCCESSFUL" -> {
                        paymentService.handlePaymentSuccess(paymentId);
                        log.info("[WEBHOOK] ✅ Succès traité — paymentId={}", paymentId);
                    }

                    case "FAILED" -> {
                        paymentService.handlePaymentFailure(paymentId,
                                "Échec signalé par webhook Campay");
                        log.info("[WEBHOOK] ❌ Échec traité — paymentId={}", paymentId);
                    }

                    case "PENDING" ->
                        // Campay peut envoyer PENDING en cours de traitement, on ignore
                        log.debug("[WEBHOOK] Statut PENDING ignoré — reference={}", reference);

                    default ->
                        log.warn("[WEBHOOK] Statut inconnu '{}' — reference={}", status, reference);
                }
            },
            () -> log.error("[WEBHOOK] Aucune transaction pour reference={} — payload ignoré",
                    reference)
        );
    }

    private String extractString(Map<String, Object> payload, String key) {
        Object val = payload.get(key);
        return (val != null && !val.toString().isBlank()) ? val.toString() : null;
    }
}
