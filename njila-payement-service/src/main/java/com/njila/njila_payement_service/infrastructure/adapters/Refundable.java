package com.njila.njila_payement_service.infrastructure.adapters;

import com.njila.njila_payement_service.application.dtos.responses.RefundResult;
import com.njila.njila_payement_service.domain.enumerations.Currency;

public interface Refundable {

    RefundResult executeRefund(String phoneNumber, Double amount, Currency currency);
}
