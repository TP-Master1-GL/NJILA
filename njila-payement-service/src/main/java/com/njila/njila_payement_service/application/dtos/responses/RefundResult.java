package com.njila.njila_payement_service.application.dtos.responses;

import com.njila.njila_payement_service.domain.enumerations.Currency;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter

@AllArgsConstructor
@NoArgsConstructor

public class RefundResult {

    private boolean success;

    private double refundedAmount;

    private Currency currency;
}
