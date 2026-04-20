package com.njila.njila_payement_service.application.services.implementations;

import com.njila.njila_payement_service.application.dtos.requests.InitiatePaymentRequest;
import com.njila.njila_payement_service.application.dtos.responses.InitiatePaymentResponse;
import com.njila.njila_payement_service.application.dtos.responses.RefundResult;
import com.njila.njila_payement_service.application.events.publishers.PaymentCancelledEvent;
import com.njila.njila_payement_service.application.events.publishers.PaymentCompletedEvent;
import com.njila.njila_payement_service.application.events.publishers.PaymentFailedEvent;
import com.njila.njila_payement_service.application.events.publishers.PaymentRefundedEvent;
import com.njila.njila_payement_service.application.services.interfaces.IdempotencyService;
import com.njila.njila_payement_service.application.services.interfaces.PaymentService;
import com.njila.njila_payement_service.application.strategy.PaymentMethodFactory;
import com.njila.njila_payement_service.application.utilities.Utilities;
import com.njila.njila_payement_service.domain.entities.Payment;
import com.njila.njila_payement_service.domain.entities.Transaction;
import com.njila.njila_payement_service.domain.enumerations.PaymentMethodType;
import com.njila.njila_payement_service.domain.enumerations.PaymentStatus;
import com.njila.njila_payement_service.domain.enumerations.TransactionStatus;
import com.njila.njila_payement_service.domain.exceptions.*;
import com.njila.njila_payement_service.domain.valueObjects.IdempotencyKey;
import com.njila.njila_payement_service.infrastructure.adapters.PaymentMethod;
import com.njila.njila_payement_service.infrastructure.adapters.Refundable;
import com.njila.njila_payement_service.infrastructure.adapters.campay.CamDtos.responses.CollectResponse;
import com.njila.njila_payement_service.infrastructure.adapters.campay.CamDtos.responses.TransactionStatusResponse;
import com.njila.njila_payement_service.infrastructure.adapters.campay.CampayAdapter;
import com.njila.njila_payement_service.infrastructure.messaging.interfaces.PaymentEventPublisher;
import com.njila.njila_payement_service.infrastructure.repositories.PaymentRepository;
import com.njila.njila_payement_service.infrastructure.repositories.TransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;


@Service

@RequiredArgsConstructor

public class PaymentServiceImpl implements PaymentService {

    private final PaymentRepository paymentRepository;

    private final TransactionRepository transactionRepository;

    private final IdempotencyService idempotencyService;

    private final PaymentMethodFactory factory;

    private final CampayAdapter campayAdapter;

    private final PaymentEventPublisher eventPublisher;


    @Override
    public InitiatePaymentResponse initiatePayment(InitiatePaymentRequest initRequest) {

        Utilities.verifyBeforeInitiateAPayment(initRequest);

        Utilities.verifyPhoneNumber(initRequest.phoneNumber());

        IdempotencyKey key = IdempotencyKey.of("payment_" + initRequest.bookingId());

        if (!idempotencyService.checkAndStore(key)) {

            try {
                paymentRepository.findPaymentByIdempotencyKeyValue(key.getValue())
                        .orElseThrow(() -> new PaymentNotFoundException("Payment not found for this key " + key.getValue()
                        ));
                throw new ExistingPaymentException("Existing payment with this key " + key.getValue());
            } catch (PaymentNotFoundException e) {

                System.out.println(e.getMessage());
            }

        }

        Payment payment = Payment.builder()
                .amount(initRequest.amount())
                .status(PaymentStatus.PENDING)
                .paymentMethodType(initRequest.paymentMethodType())
                .currency(initRequest.currency())
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .bookingId(initRequest.bookingId())
                .passengerId(initRequest.passengerId())
                .phoneNumber(initRequest.phoneNumber())
                .idempotencyKeyValue(key.getValue())
                .build();

        Payment p = paymentRepository.save(payment);

        System.out.println("e.getMessage()");

        return Utilities.mapToInitiatePaymentResponse(p);


    }

    @Override
    public void processPayment(long paymentId) {

        Payment payment = paymentRepository.findByPaymentId(paymentId)
                .orElseThrow(() -> new PaymentNotFoundException(
                        "Payment not found for this paymentId " + paymentId
                ));

        payment.initiate();

        factory.getStrategy(payment.getPaymentMethodType());

        CollectResponse response = campayAdapter.executePaymentWithDetails(
                payment.getAmount(),
                payment.getCurrency(),
                payment.getPhoneNumber(),
                UUID.randomUUID().toString()
        );

        Transaction t = Transaction.create(
                payment,
                response.getReference(),
                UUID.randomUUID().toString(),
                payment.getAmount(),
                payment.getCurrency()
        );


        t.setOperator(
                response.getOperator()
        );

        t.setResponseCode(
                response.getUssd_code()
        );


        transactionRepository.save(t);

        paymentRepository.save(payment);

    }

    @Override
    public void confirmCashPayment(long paymentId) {

        Payment payment = paymentRepository.findByPaymentId(paymentId)
                .orElseThrow(() -> new PaymentNotFoundException(
                        "Payment not found " + paymentId
                ));

        if (payment.getPaymentMethodType() != PaymentMethodType.CASH) {

            throw new InvalidPaymentOperationException("Only Cash payment method are confirmed");
        }

        Transaction t = transactionRepository
                .findByPayment(payment)
                .orElseThrow(
                        () -> new PaymentNotFoundException("Transaction not found")
                );

        t.markSucceed();
        payment.confirm();

        transactionRepository.save(t);
        paymentRepository.save(payment);

        eventPublisher.publishPaymentCompleted(
                new PaymentCompletedEvent(
                        payment.getPaymentId(),
                        payment.getBookingId(),
                        payment.getPassengerId(),
                        payment.getAmount(),
                        payment.getCurrency(),
                        LocalDateTime.now()
                )
        );

    }

    @Override
    public PaymentStatus getPaymentStatus(long paymentId) {

        Payment payment = paymentRepository.findByPaymentId(paymentId).orElse(null);

        if (payment == null) {

            throw new PaymentNotFoundException("Payment not found");
        }

        Transaction transaction = transactionRepository.findByPayment_PaymentId(paymentId)
                .stream()
                .sorted(
                        Comparator
                                .comparing(Transaction::getUpdatedAt)
                                .reversed()
                ).toList()
                .stream()
                .findFirst()
                .orElseThrow(() -> new TransactionNotFoundException("Transaction not found"));


        TransactionStatusResponse response = campayAdapter.getTransactionStatus(transaction.getProvidedReference());

        if(!response.getStatus().equals(transaction.getStatus().getValue())){

            transaction.setStatus(TransactionStatus.fromValue(response.getStatus()));

            switch (response.getStatus()) {

                case "SUCCESSFUL":
                    payment.confirm();
                    break;

                case "FAILED":
                    payment.fail();
                    break;

                case "PENDING":
                    break;

                default:
                    throw new IllegalArgumentException("Invalid status " + response.getStatus());
            }

            transactionRepository.save(transaction);

            payment = paymentRepository.save(payment);
        }

        return payment.getStatus();
    }

    @Override
    public List<Payment> getPaymentByPassenger(long passengerId) {

        List<Payment> payments = paymentRepository.findByPassengerId(passengerId);

        if (payments.isEmpty()) {
            throw new PaymentNotFoundException("Payment not found");
        }

        return payments;
    }

    @Override
    public void CancelPayment(long paymentId) {

        Payment payment = paymentRepository.findByPaymentId(paymentId)
                .orElseThrow(() -> new PaymentNotFoundException(
                        "Payment not found " + paymentId
                ));

        payment.cancel();

        transactionRepository
                .findByPayment(payment)
                .ifPresent(transaction -> {
                    transaction.markFailed();
                    transactionRepository.save(transaction);
                });

        paymentRepository.save(payment);

        eventPublisher.publishPaymentCancelled(
                new PaymentCancelledEvent(
                        payment.getPaymentId(),
                        payment.getBookingId(),
                        payment.getPassengerId(),
                        LocalDateTime.now()
                )
        );
    }

    @Override
    public RefundResult refundPayment(long paymentId, double amount) {

        Payment payment = paymentRepository.findByPaymentId(paymentId)
                .orElseThrow(() -> new PaymentNotFoundException(
                        "Payment not found " + paymentId
                ));

        if (!payment.getStatus().equals(PaymentStatus.COMPLETED)) {

            throw new InvalidPaymentOperationException("Only payment with status COMPLETED can be refunded");
        }

        if (amount <= 0.0 || amount > payment.getAmount()) {

            throw new InvalidAmountException("Invalid amount: " + amount);
        }

        PaymentMethod adapter = factory.getStrategy(payment.getPaymentMethodType());

        if (!(adapter instanceof Refundable)) {

            throw new NonRefundablePaymentMethodException("This payment type doesn't support the refund");
        }


        RefundResult response = campayAdapter.executeRefund(
                payment.getPhoneNumber(),
                amount,
                payment.getCurrency()
        );

        if (!response.isSuccess()) {

            throw new CamPayException("Payment refund failed");
        }


        if (amount == payment.getAmount()) {
            payment.refund();
        }

        if (amount < payment.getAmount()) {
            payment.partialRefund();
        }

        paymentRepository.save(payment);

        eventPublisher.publishPaymentRefunded(
                new PaymentRefundedEvent(
                        payment.getPaymentId(),
                        payment.getBookingId(),
                        payment.getPassengerId(),
                        payment.getAmount(),
                        payment.getCurrency(),
                        LocalDate.now()
                )
        );

        eventPublisher.publishPaymentRefunded(
                new PaymentRefundedEvent(
                        payment.getPaymentId(),
                        payment.getBookingId(),
                        payment.getPassengerId(),
                        payment.getAmount(),
                        payment.getCurrency(),
                        LocalDate.now()
                )
        );
        return response;
    }

    @Override
    public void paymentTimeout(long paymentId) {

        Payment payment = paymentRepository
                .findByPaymentId(paymentId)
                .orElseThrow(() -> new PaymentNotFoundException("Payment not found " + paymentId));


        if (!payment.getStatus().equals(PaymentStatus.PROCESSING)) {

            throw new InvalidPaymentOperationException("Only payment with status COMPLETED can timeout");
        }

        transactionRepository.findByPayment(payment)
                .ifPresent(transaction -> {
                    transaction.timeout();
                    transactionRepository.save(transaction);
                });

        payment.expire();

        paymentRepository.save(payment);


        eventPublisher.publishPaymentFailed(
                new PaymentFailedEvent(
                        payment.getPaymentId(),
                        payment.getBookingId(),
                        payment.getPassengerId(),
                        "Timeout - no response from CamPay",
                        LocalDateTime.now()
                )
        );
    }

    @Override
    public List<Payment> getAllPayments() {

        List<Payment> all = paymentRepository.findAll();

        if (all.isEmpty()) {

            throw new PaymentNotFoundException("No payments yet");
        }

        return all;
    }

}
