package com.njila.njila_payement_service.application.events.publishers;

import com.njila.njila_payement_service.domain.enumerations.Currency;
import com.njila.njila_payement_service.domain.enumerations.PaymentMethodType;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;


@Getter
@Setter

@AllArgsConstructor
@NoArgsConstructor

public class PaymentCancelledEvent {

    private long paymentId;

    private long bookingId;

    private long passengerId;

    private LocalDateTime cancelledAt;

}
