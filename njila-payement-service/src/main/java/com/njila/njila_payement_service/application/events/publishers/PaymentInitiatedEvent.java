package com.njila.njila_payement_service.application.events.publishers;

import com.njila.njila_payement_service.domain.enumerations.Currency;
import com.njila.njila_payement_service.domain.enumerations.PaymentMethodType;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;


@Getter
@Setter

@AllArgsConstructor
@NoArgsConstructor

public class PaymentInitiatedEvent {

        private long bookingId;

        private long passengerId;

        private double amount;

        private Currency currency;

        private PaymentMethodType paymentMethodType;

        private String phoneNumber;

        private LocalDate date;
}
