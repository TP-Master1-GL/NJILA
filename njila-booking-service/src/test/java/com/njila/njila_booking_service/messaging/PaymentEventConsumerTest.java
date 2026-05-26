package com.njila.njila_booking_service.messaging;

import com.njila.njila_booking_service.messaging.consumer.PaymentEventConsumer;
import com.njila.njila_booking_service.service.ReservationService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PaymentEventConsumerTest {

    @Mock
    private ReservationService reservationService;

    @InjectMocks
    private PaymentEventConsumer consumer;

    // ─── onPaymentConfirmed ───────────────────────────────────────────────────

    @Test
    void onPaymentConfirmed_appelleLaConfirmation() {
        Map<String, Object> payload = Map.of(
                "bookingId",     "1",
                "transactionId", "TXN-001",
                "statut",        "REUSSI"
        );

        consumer.onPaymentConfirmed(payload);

        verify(reservationService).confirmerApresPaiement(1L, "TXN-001");
    }

    @Test
    void onPaymentConfirmed_bookingIdNumerique_converti() {
        Map<String, Object> payload = Map.of(
                "bookingId",     42,
                "transactionId", "TXN-042"
        );

        consumer.onPaymentConfirmed(payload);

        verify(reservationService).confirmerApresPaiement(42L, "TXN-042");
    }

    @Test
    void onPaymentConfirmed_sansTransactionId_utiliseFallbackPaymentId() {
        // Si transactionId absent, le consumer utilise paymentId comme fallback
        Map<String, Object> payload = Map.of(
                "bookingId", "5",
                "paymentId", "PAY-999"
        );

        consumer.onPaymentConfirmed(payload);

        verify(reservationService).confirmerApresPaiement(5L, "PAY-999");
    }

    @Test
    void onPaymentConfirmed_sansTransactionIdNiPaymentId_utiliseUnknown() {
        // Aucun identifiant de transaction → fallback "UNKNOWN"
        Map<String, Object> payload = Map.of("bookingId", "7");

        consumer.onPaymentConfirmed(payload);

        verify(reservationService).confirmerApresPaiement(7L, "UNKNOWN");
    }

    @Test
    void onPaymentConfirmed_bookingIdAbsent_nAppellePasLeService() {
        Map<String, Object> payload = Map.of("transactionId", "TXN-X");

        consumer.onPaymentConfirmed(payload);

        verify(reservationService, never()).confirmerApresPaiement(any(), any());
    }

    @Test
    void onPaymentConfirmed_serviceLeveException_propage() {
        Map<String, Object> payload = Map.of(
                "bookingId",     "1",
                "transactionId", "TXN-001"
        );
        doThrow(new RuntimeException("Réservation introuvable : 1"))
                .when(reservationService).confirmerApresPaiement(1L, "TXN-001");

        // Le consumer re-throw pour que RabbitMQ route vers la DLQ
        assertThatThrownBy(() -> consumer.onPaymentConfirmed(payload))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("introuvable");
    }

    // ─── onPaymentFailed ─────────────────────────────────────────────────────

    @Test
    void onPaymentFailed_appelleSupprimerAvecMotif() {
        // La méthode du service est supprimerApresEchecPaiement(bookingId, motif)
        Map<String, Object> payload = Map.of(
                "bookingId", "1",
                "motif",     "Solde insuffisant"
        );

        consumer.onPaymentFailed(payload);

        verify(reservationService).supprimerApresEchecPaiement(1L, "Solde insuffisant");
    }

    @Test
    void onPaymentFailed_sansMotif_utiliseMotifParDefaut() {
        // Pas de champ "motif" → fallback "Échec paiement"
        Map<String, Object> payload = Map.of("bookingId", "1");

        consumer.onPaymentFailed(payload);

        verify(reservationService).supprimerApresEchecPaiement(1L, "Échec paiement");
    }

    @Test
    void onPaymentFailed_bookingIdNumerique_converti() {
        Map<String, Object> payload = Map.of(
                "bookingId", 99,
                "motif",     "Timeout"
        );

        consumer.onPaymentFailed(payload);

        verify(reservationService).supprimerApresEchecPaiement(99L, "Timeout");
    }

    @Test
    void onPaymentFailed_bookingIdAbsent_nAppellePasLeService() {
        Map<String, Object> payload = Map.of("motif", "Erreur inconnue");

        consumer.onPaymentFailed(payload);

        verify(reservationService, never()).supprimerApresEchecPaiement(any(), any());
    }

    @Test
    void onPaymentFailed_serviceLeveException_propage() {
        Map<String, Object> payload = Map.of("bookingId", "2");
        doThrow(new RuntimeException("Réservation introuvable : 2"))
                .when(reservationService).supprimerApresEchecPaiement(eq(2L), anyString());

        assertThatThrownBy(() -> consumer.onPaymentFailed(payload))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("introuvable");
    }
}