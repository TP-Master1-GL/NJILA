package com.njila.njila_payement_service.infrastructure.controllers;


import com.njila.njila_payement_service.application.dtos.responses.RefundResult;
import com.njila.njila_payement_service.application.services.interfaces.PaymentService;
import com.njila.njila_payement_service.domain.entities.Payment;
import com.njila.njila_payement_service.domain.enumerations.PaymentStatus;
import com.njila.njila_payement_service.domain.exceptions.InvalidAmountException;
import com.njila.njila_payement_service.domain.exceptions.InvalidPaymentOperationException;
import com.njila.njila_payement_service.domain.exceptions.NonRefundablePaymentMethodException;
import com.njila.njila_payement_service.domain.exceptions.PaymentNotFoundException;
import feign.FeignException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("api/v1/payment")
@RequiredArgsConstructor
public class PaymentController {

    private final PaymentService paymentService;


   // Les méthodes initiatePayment() et processProcessPayment()
    // n'ont pas besoin endpoints, elles sont directement déclenchés dans la méthode de handle() qui traite l'évènement reçu.


    // PATCH /api/v1/njila-payment-service/confirm-cash/{paymentId}
    @PatchMapping("/confirm-cash/{paymentId}")
    public ResponseEntity<String> confirmCashPayment(@PathVariable long paymentId) {

        try {
            paymentService.confirmCashPayment(paymentId);
            return ResponseEntity.ok("Cash payment confirmed!");

        } catch (PaymentNotFoundException e) {
            return ResponseEntity.notFound().build();

        } catch (InvalidPaymentOperationException e) {
            return ResponseEntity.badRequest().body(e.getMessage());

        } catch (Exception e) {
            return ResponseEntity.internalServerError().body("Unexpected error: " + e.getMessage());
        }
    }

    // GET /api/v1/njila-payment-service/status/{paymentId}
    @GetMapping("/status/{paymentId}")
    public ResponseEntity<PaymentStatus> getPaymentStatus(@PathVariable long paymentId) {

        try {
            PaymentStatus status = paymentService.getPaymentStatus(paymentId);
            return ResponseEntity.ok(status);

        } catch (PaymentNotFoundException e) {
            return ResponseEntity.notFound().build();

        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    // GET /api/v1/njila-payment-service/passenger/{passengerId}
    @GetMapping("/passenger/{passengerId}")
    public ResponseEntity<List<Payment>> getPaymentsByPassenger(@PathVariable long passengerId) {

        try {
            List<Payment> payments = paymentService.getPaymentByPassenger(passengerId);
            return ResponseEntity.ok(payments);

        } catch (PaymentNotFoundException e) {
            return ResponseEntity.notFound().build();

        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    // PATCH /api/v1/njila-payment-service/cancel/{paymentId}
    @PatchMapping("/cancel/{paymentId}")
    public ResponseEntity<String> cancelPayment(@PathVariable long paymentId) {

        try {
            paymentService.CancelPayment(paymentId);
            return ResponseEntity.ok("Payment cancelled.");

        } catch (PaymentNotFoundException e) {
            return ResponseEntity.notFound().build();

        } catch (InvalidPaymentOperationException e) {
            return ResponseEntity.badRequest().body(e.getMessage());

        } catch (Exception e) {
            return ResponseEntity.internalServerError().body("Unexpected error: " + e.getMessage());
        }
    }

    // GET /api/payment/all
    @GetMapping("/all")
    public ResponseEntity<List<Payment>> getAllPayments() {
        try {
            List<Payment> payments = paymentService.getAllPayments();
            return ResponseEntity.ok(payments);

        } catch (PaymentNotFoundException e) {
            return ResponseEntity.notFound().build();

        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    // POST /api/v1/njila-payment-service/refund/{paymentId}?amount=...
    @PostMapping("/refund/{paymentId}")
    public ResponseEntity<RefundResult> refundPayment(
            @PathVariable long paymentId,
            @RequestParam double amount) {

        try {
            RefundResult result = paymentService.refundPayment(paymentId, amount);
            return ResponseEntity.ok(result);

        } catch (PaymentNotFoundException e) {
            return ResponseEntity.notFound().build();

        } catch (InvalidPaymentOperationException | InvalidAmountException | NonRefundablePaymentMethodException e) {
            return ResponseEntity.badRequest().build();

        } catch (FeignException.Unauthorized e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();

        } catch (Exception e) {
         return ResponseEntity.internalServerError().build();
        }
    }
}
