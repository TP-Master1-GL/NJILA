package com.njila.njila_booking_service.messaging;

import com.njila.njila_booking_service.messaging.consumer.PaymentEventConsumer;
import com.njila.njila_booking_service.service.ReservationService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import java.util.Map;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PaymentEventConsumerTest {

    @Mock
    private ReservationService reservationService;

    @InjectMocks
    private PaymentEventConsumer consumer;

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
    void onPaymentFailed_appelleAnnulation() {
        Map<String, Object> payload = Map.of("bookingId", "1");

        consumer.onPaymentFailed(payload);

        verify(reservationService).annulerApresEchecPaiement(1L);
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
    void onPaymentFailed_bookingIdNumerique_converti() {
        Map<String, Object> payload = Map.of("bookingId", 99);

        consumer.onPaymentFailed(payload);

        verify(reservationService).annulerApresEchecPaiement(99L);
    }
}