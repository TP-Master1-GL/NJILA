package com.njila.njila_payement_service.application.events.consumers;

import com.njila.njila_payement_service.domain.enumerations.Currency;
import com.njila.njila_payement_service.domain.enumerations.PaymentMethodType;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class BookingCreatedEvent {
    private long bookingId;
    private String passengerId;   // ← était long, corrigé en String (UUID)
    private double amount;
    private String phoneNumber;
    private Currency currency;
    private PaymentMethodType paymentMethodType;
}
