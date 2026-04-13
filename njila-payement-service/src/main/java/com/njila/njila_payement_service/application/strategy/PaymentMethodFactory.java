package com.njila.njila_payement_service.application.strategy;

import com.njila.njila_payement_service.domain.enumerations.PaymentMethodType;
import com.njila.njila_payement_service.domain.exceptions.UnsupportedPaymentMethodException;
import com.njila.njila_payement_service.infrastructure.adapters.campay.CampayAdapter;
import com.njila.njila_payement_service.infrastructure.adapters.cash.CashPaymentHandler;
import com.njila.njila_payement_service.infrastructure.adapters.PaymentMethod;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@RequiredArgsConstructor

@Component

public class PaymentMethodFactory {

    private final CampayAdapter campayAdapter;

    private final CashPaymentHandler cashHandler;

    public PaymentMethod getStrategy(PaymentMethodType type){

        if(type == null){
            throw new UnsupportedPaymentMethodException("The payment method type cannot be null");
        }

        switch (type){

            case CASH:
                return cashHandler;

            case MOBILE_MONEY:
                return campayAdapter;

                default:
                    throw new UnsupportedPaymentMethodException("There's no such payment method");
        }

    }
}
