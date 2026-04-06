package com.njila.njila_payement_service.application.services.interfaces;

import com.njila.njila_payement_service.domain.entities.Payment;
import com.njila.njila_payement_service.domain.enumerations.PaymentStatus;

import java.util.UUID;

public interface PaymentService {

    // To improve

    void initiatePayment();

    void processPayment(UUID paymentId);

    void confirmCashPayment(UUID paymentId);

    void handleCallback();

    PaymentStatus getPaymentStatus(UUID paymentId);

    Payment getPaymentByPassenger(int passengerId);


}
