package com.njila.njila_payement_service.application.services.interfaces;

import com.njila.njila_payement_service.application.callbackPayload.CallbackPayload;
import com.njila.njila_payement_service.application.dtos.requests.InitiatePaymentRequest;
import com.njila.njila_payement_service.application.dtos.responses.InitiatePaymentResponse;
import com.njila.njila_payement_service.domain.entities.Payment;
import com.njila.njila_payement_service.domain.enumerations.PaymentStatus;

import java.util.List;
import java.util.UUID;

public interface PaymentService {

    InitiatePaymentResponse initiatePayment(InitiatePaymentRequest initRequest);

    void processPayment(long paymentId);

    void confirmCashPayment(long paymentId);

    void handleCallback(CallbackPayload payload);

    PaymentStatus getPaymentStatus(long paymentId);

    List<Payment> getPaymentByPassenger(long passengerId);

    void CancelPayment(long paymentId);



}
