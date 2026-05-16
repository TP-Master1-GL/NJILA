package com.njila.njila_payement_service.application.services.interfaces;

import com.njila.njila_payement_service.application.dtos.requests.InitiatePaymentRequest;
import com.njila.njila_payement_service.application.dtos.requests.RefundPaymentRequest;
import com.njila.njila_payement_service.application.dtos.responses.InitiatePaymentResponse;
import com.njila.njila_payement_service.application.dtos.responses.RefundResult;
import com.njila.njila_payement_service.domain.entities.Payment;
import com.njila.njila_payement_service.domain.enumerations.PaymentStatus;

import java.util.List;

public interface PaymentService {

    // Initier un paiement (idempotent — retourne l'existant si déjà créé)
    InitiatePaymentResponse initiatePayment(InitiatePaymentRequest initRequest);

    // Traiter le paiement via l'opérateur (Campay) + démarrer le polling
    void processPayment(long paymentId);

    // Statut simple depuis la BDD, sans appel Campay (utilisé par le listener MQ)
    PaymentStatus getPaymentStatusById(long paymentId);

    // Statut enrichi : interroge aussi Campay si non terminal (endpoint REST)
    PaymentStatus getPaymentStatus(long paymentId);

    // Appelé par le polling ET par le webhook Campay quand SUCCESSFUL
    void handlePaymentSuccess(long paymentId);

    // Appelé par le polling ET par le webhook Campay quand FAILED
    void handlePaymentFailure(long paymentId, String reason);

    // Paiements d'un passager
    List<Payment> getPaymentByPassenger(String passengerId);

    // Tous les paiements
    List<Payment> getAllPayments();

    // Confirmer un paiement cash manuellement
    void confirmCashPayment(long paymentId);

    // Annuler un paiement
    void CancelPayment(long paymentId);

    // Rembourser via bookingId (événement booking.refund.requested)
    void processRefund(RefundPaymentRequest request);

    // Rembourser via paymentId (endpoint REST direct)
    RefundResult refundPayment(long paymentId, double amount);

    // Timeout d'un paiement resté PROCESSING trop longtemps
    void paymentTimeout(long paymentId);
}
