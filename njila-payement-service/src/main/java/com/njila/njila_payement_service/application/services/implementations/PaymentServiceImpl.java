package com.njila.njila_payement_service.application.services.implementations;

import com.njila.njila_payement_service.application.services.interfaces.PaymentService;
import com.njila.njila_payement_service.domain.entities.Payment;
import com.njila.njila_payement_service.domain.enumerations.PaymentStatus;

import java.util.UUID;

public class PaymentServiceImpl implements PaymentService {
    @Override
    public void initiatePayment() {

    }

    @Override
    public void processPayment(UUID paymentId) {

    }

    @Override
    public void confirmCashPayment(UUID paymentId) {

    }

    @Override
    public void handleCallback() {

    }

    @Override
    public PaymentStatus getPaymentStatus(UUID paymentId) {
        return null;
    }

    @Override
    public Payment getPaymentByPassenger(int passengerId) {
        return null;
    }
}
