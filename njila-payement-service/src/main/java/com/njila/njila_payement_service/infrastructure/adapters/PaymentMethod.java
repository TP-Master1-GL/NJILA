package com.njila.njila_payement_service.infrastructure.adapters;

import com.njila.njila_payement_service.domain.enumerations.Currency;


public interface PaymentMethod {

    String executePayment(Double amount, Currency currency, String phoneNumber, String externalReference);
}
