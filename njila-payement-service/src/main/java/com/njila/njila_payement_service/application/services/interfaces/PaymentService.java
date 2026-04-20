package com.njila.njila_payement_service.application.services.interfaces;

import com.njila.njila_payement_service.application.dtos.requests.InitiatePaymentRequest;
import com.njila.njila_payement_service.application.dtos.responses.InitiatePaymentResponse;
import com.njila.njila_payement_service.application.dtos.responses.RefundResult;
import com.njila.njila_payement_service.domain.entities.Payment;
import com.njila.njila_payement_service.domain.enumerations.PaymentStatus;

import java.util.List;

public interface PaymentService {

    InitiatePaymentResponse initiatePayment(InitiatePaymentRequest initRequest);

    void processPayment(long paymentId);

    void confirmCashPayment(long paymentId);

    PaymentStatus getPaymentStatus(long paymentId);

    List<Payment> getPaymentByPassenger(long passengerId);

    void CancelPayment(long paymentId);

    RefundResult refundPayment(long paymentId, double amount);

    void paymentTimeout(long paymentId);


    List<Payment> getAllPayments();

}
