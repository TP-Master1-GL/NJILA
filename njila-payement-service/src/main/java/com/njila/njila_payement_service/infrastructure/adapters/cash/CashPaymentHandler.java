package com.njila.njila_payement_service.infrastructure.adapters.cash;

import com.njila.njila_payement_service.domain.enumerations.Currency;
import com.njila.njila_payement_service.infrastructure.adapters.PaymentMethod;
import org.springframework.stereotype.Component;


import java.util.UUID;

@Component

public class CashPaymentHandler implements PaymentMethod {

    @Override
    public String executePayment(Double amount, Currency currency, String phoneNumber, String externalReference) {

        return "CASH-" + UUID.randomUUID().toString().toUpperCase() ;
    }
}
