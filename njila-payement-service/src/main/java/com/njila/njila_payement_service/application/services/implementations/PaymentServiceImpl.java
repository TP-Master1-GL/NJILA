package com.njila.njila_payement_service.application.services.implementations;

import com.njila.njila_payement_service.application.dtos.requests.InitiatePaymentRequest;
import com.njila.njila_payement_service.application.dtos.requests.RefundPaymentRequest;
import com.njila.njila_payement_service.application.dtos.responses.InitiatePaymentResponse;
import com.njila.njila_payement_service.application.dtos.responses.RefundResult;
import com.njila.njila_payement_service.application.events.publishers.*;
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
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class PaymentServiceImpl implements PaymentService {

    private final PaymentRepository     paymentRepository;
    private final TransactionRepository transactionRepository;
    private final IdempotencyService    idempotencyService;
    private final PaymentMethodFactory  factory;
    private final CampayAdapter         campayAdapter;
    private final PaymentEventPublisher eventPublisher;

    private static final long POLL_INTERVAL_MS = 5_000L;
    private static final long POLL_TIMEOUT_MS  = 10 * 60 * 1_000L;

    // ─────────────────────────────────────────────────────────────────────────
    // INITIER UN PAIEMENT
    // ─────────────────────────────────────────────────────────────────────────

    @Override
    public InitiatePaymentResponse initiatePayment(InitiatePaymentRequest initRequest) {

        Utilities.verifyBeforeInitiateAPayment(initRequest);
        Utilities.verifyPhoneNumber(initRequest.phoneNumber());

        IdempotencyKey key = IdempotencyKey.of("payment_" + initRequest.bookingId());

        // Si la clé existe déjà → retourner le paiement existant (idempotence)
        // On ne lève PLUS d'exception : le listener peut rappeler sans boucle infinie
        if (!idempotencyService.checkAndStore(key)) {
            log.warn("[PAYMENT] Clé idempotence déjà présente — retour du paiement existant : {}",
                    key.getValue());
            return paymentRepository.findPaymentByIdempotencyKeyValue(key.getValue())
                    .map(Utilities::mapToInitiatePaymentResponse)
                    .orElseThrow(() -> new PaymentNotFoundException(
                            "Payment not found for key " + key.getValue()));
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
        log.info("[PAYMENT] Nouveau paiement créé — paymentId={} bookingId={}",
                p.getPaymentId(), p.getBookingId());
        return Utilities.mapToInitiatePaymentResponse(p);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // STATUT SIMPLE PAR ID (sans appel Campay — lecture BDD uniquement)
    // ─────────────────────────────────────────────────────────────────────────

    @Override
    public PaymentStatus getPaymentStatusById(long paymentId) {
        return paymentRepository.findByPaymentId(paymentId)
                .map(Payment::getStatus)
                .orElseThrow(() -> new PaymentNotFoundException(
                        "Payment not found for id " + paymentId));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TRAITER UN PAIEMENT (appel opérateur + polling asynchrone)
    // ─────────────────────────────────────────────────────────────────────────

    @Override
    public void processPayment(long paymentId) {

        Payment payment = paymentRepository.findByPaymentId(paymentId)
                .orElseThrow(() -> new PaymentNotFoundException(
                        "Payment not found for this paymentId " + paymentId));

        // Guard : ne traiter que si PENDING
        if (payment.getStatus() != PaymentStatus.PENDING) {
            log.warn("[PAYMENT] processPayment ignoré — statut actuel={} paymentId={}",
                    payment.getStatus(), paymentId);
            return;
        }

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
        t.setOperator(response.getOperator());
        t.setResponseCode(response.getUssd_code());

        transactionRepository.save(t);
        paymentRepository.save(payment);

        log.info("[PAYMENT] Paiement PROCESSING — paymentId={} reference={}",
                paymentId, response.getReference());

        pollPaymentStatusAsync(paymentId, response.getReference());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POLLING ASYNCHRONE — surveille la confirmation Campay
    // ─────────────────────────────────────────────────────────────────────────

    @Async("campayPollingExecutor")
    public void pollPaymentStatusAsync(long paymentId, String campayReference) {

        log.info("[POLL] Démarrage polling — paymentId={} reference={}",
                paymentId, campayReference);

        long start   = System.currentTimeMillis();
        long elapsed = 0;

        while (elapsed < POLL_TIMEOUT_MS) {

            try {
                Thread.sleep(POLL_INTERVAL_MS);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                log.warn("[POLL] Thread interrompu — paymentId={}", paymentId);
                return;
            }

            elapsed = System.currentTimeMillis() - start;

            try {
                TransactionStatusResponse statusResponse =
                        campayAdapter.getTransactionStatus(campayReference);

                String campayStatus = statusResponse.getStatus();
                log.info("[POLL] paymentId={} reference={} campayStatus={}",
                        paymentId, campayReference, campayStatus);

                switch (campayStatus) {

                    case "SUCCESSFUL" -> {
                        handlePaymentSuccess(paymentId);
                        return;
                    }

                    case "FAILED" -> {
                        handlePaymentFailure(paymentId, "Échec opérateur Campay");
                        return;
                    }

                    case "PENDING" ->
                        log.debug("[POLL] Toujours PENDING — paymentId={} elapsed={}ms",
                                paymentId, elapsed);

                    default ->
                        log.warn("[POLL] Statut inconnu '{}' — paymentId={}",
                                campayStatus, paymentId);
                }

            } catch (Exception e) {
                log.error("[POLL] Erreur interrogation Campay — paymentId={} : {}",
                        paymentId, e.getMessage());
            }
        }

        log.warn("[POLL] Timeout — paymentId={} après {}ms", paymentId, elapsed);
        try {
            paymentTimeout(paymentId);
        } catch (Exception e) {
            log.error("[POLL] Erreur lors du timeout — paymentId={} : {}",
                    paymentId, e.getMessage());
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // HANDLE SUCCÈS — transition + publication événement
    // (appelé par le polling ET par le webhook Campay)
    // ─────────────────────────────────────────────────────────────────────────

    public void handlePaymentSuccess(long paymentId) {

        Payment payment = paymentRepository.findByPaymentId(paymentId)
                .orElseThrow(() -> new PaymentNotFoundException(
                        "Payment not found " + paymentId));

        if (payment.getStatus() == PaymentStatus.COMPLETED) {
            log.warn("[PAYMENT] Déjà COMPLETED — paymentId={} (doublon ignoré)", paymentId);
            return;
        }

        if (isTerminalStatus(payment.getStatus())) {
            log.warn("[PAYMENT] État terminal {} — paymentId={} (doublon ignoré)",
                    payment.getStatus(), paymentId);
            return;
        }

        transactionRepository.findByPayment(payment).ifPresent(t -> {
            if (t.getStatus() == TransactionStatus.INITIATED) {
                t.authorize();
            }
            if (t.getStatus() == TransactionStatus.AUTHORIZED) {
                t.markSucceed();
            }
            transactionRepository.save(t);
        });

        payment.confirm();
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

        log.info("[PAYMENT] ✅ payment.succeed publié — paymentId={} bookingId={}",
                payment.getPaymentId(), payment.getBookingId());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // HANDLE ÉCHEC — transition + publication événement
    // (appelé par le polling ET par le webhook Campay)
    // ─────────────────────────────────────────────────────────────────────────

    public void handlePaymentFailure(long paymentId, String reason) {

        Payment payment = paymentRepository.findByPaymentId(paymentId)
                .orElseThrow(() -> new PaymentNotFoundException(
                        "Payment not found " + paymentId));

        if (isTerminalStatus(payment.getStatus())) {
            log.warn("[PAYMENT] État terminal {} — paymentId={} (doublon ignoré)",
                    payment.getStatus(), paymentId);
            return;
        }

        transactionRepository.findByPayment(payment).ifPresent(t -> {
            try {
                t.markFailed();
                transactionRepository.save(t);
            } catch (Exception e) {
                log.warn("[PAYMENT] Transition transaction impossible : {}", e.getMessage());
            }
        });

        payment.fail();
        paymentRepository.save(payment);

        eventPublisher.publishPaymentFailed(
                new PaymentFailedEvent(
                        payment.getPaymentId(),
                        payment.getBookingId(),
                        payment.getPassengerId(),
                        reason,
                        LocalDateTime.now()
                )
        );

        log.info("[PAYMENT] ❌ payment.failed publié — paymentId={} bookingId={} raison={}",
                payment.getPaymentId(), payment.getBookingId(), reason);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TRAITER UN REMBOURSEMENT (déclenché par booking.refund.requested)
    // ─────────────────────────────────────────────────────────────────────────

    @Override
    public void processRefund(RefundPaymentRequest request) {

        log.info("[PAYMENT] Remboursement demandé — bookingId={} montant={} {}",
                request.bookingId(), request.amount(), request.currency());

        Payment payment = paymentRepository.findPaymentByBookingId(request.bookingId())
                .orElseThrow(() -> new PaymentNotFoundException(
                        "Aucun paiement trouvé pour bookingId=" + request.bookingId()));

        if (!payment.getStatus().equals(PaymentStatus.COMPLETED)) {
            throw new InvalidPaymentOperationException(
                    "Seul un paiement COMPLETED peut être remboursé — statut actuel : "
                    + payment.getStatus());
        }

        double montant = request.amount() != null ? request.amount() : payment.getAmount();

        if (montant <= 0.0 || montant > payment.getAmount()) {
            throw new InvalidAmountException("Montant de remboursement invalide : " + montant);
        }

        PaymentMethod adapter = factory.getStrategy(payment.getPaymentMethodType());
        if (!(adapter instanceof Refundable)) {
            throw new NonRefundablePaymentMethodException(
                    "Ce type de paiement ne supporte pas le remboursement");
        }

        RefundResult result = campayAdapter.executeRefund(
                payment.getPhoneNumber(),
                montant,
                payment.getCurrency()
        );

        if (!result.isSuccess()) {
            throw new CamPayException("Remboursement échoué côté opérateur");
        }

        if (montant == payment.getAmount()) {
            payment.refund();
        } else {
            payment.partialRefund();
        }
        paymentRepository.save(payment);

        eventPublisher.publishPaymentRefunded(
                new PaymentRefundedEvent(
                        payment.getPaymentId(),
                        payment.getBookingId(),
                        payment.getPassengerId(),
                        montant,
                        payment.getCurrency(),
                        LocalDate.now()
                )
        );

        log.info("[PAYMENT] Remboursement exécuté — bookingId={} montant={} statut={}",
                request.bookingId(), montant, payment.getStatus());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CONFIRMER PAIEMENT CASH
    // ─────────────────────────────────────────────────────────────────────────

    @Override
    public void confirmCashPayment(long paymentId) {

        Payment payment = paymentRepository.findByPaymentId(paymentId)
                .orElseThrow(() -> new PaymentNotFoundException(
                        "Payment not found " + paymentId));

        if (payment.getPaymentMethodType() != PaymentMethodType.CASH) {
            throw new InvalidPaymentOperationException(
                    "Only Cash payment method are confirmed");
        }

        Transaction t = transactionRepository.findByPayment(payment)
                .orElseThrow(() -> new PaymentNotFoundException("Transaction not found"));

        if (t.getStatus() == TransactionStatus.INITIATED) {
            t.authorize();
        }
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

    // ─────────────────────────────────────────────────────────────────────────
    // STATUT D'UN PAIEMENT (endpoint GET /status/{id} — vérification + Campay)
    // ─────────────────────────────────────────────────────────────────────────

    @Override
    public PaymentStatus getPaymentStatus(long paymentId) {

        Payment payment = paymentRepository.findByPaymentId(paymentId)
                .orElseThrow(() -> new PaymentNotFoundException("Payment not found"));

        if (isTerminalStatus(payment.getStatus())) {
            return payment.getStatus();
        }

        Transaction transaction = transactionRepository
                .findByPayment_PaymentId(paymentId)
                .stream()
                .sorted(Comparator.comparing(Transaction::getUpdatedAt).reversed())
                .findFirst()
                .orElseThrow(() -> new TransactionNotFoundException("Transaction not found"));

        TransactionStatusResponse response =
                campayAdapter.getTransactionStatus(transaction.getProvidedReference());

        String campayStatus = response.getStatus();

        if (!campayStatus.equals(transaction.getStatus().getValue())) {
            switch (campayStatus) {
                case "SUCCESSFUL" -> handlePaymentSuccess(paymentId);
                case "FAILED"     -> handlePaymentFailure(paymentId,
                        "Échec opérateur : " + campayStatus);
                case "PENDING"    -> { /* rien */ }
                default -> throw new IllegalArgumentException(
                        "Invalid status " + campayStatus);
            }
        }

        return paymentRepository.findByPaymentId(paymentId)
                .map(Payment::getStatus)
                .orElseThrow(() -> new PaymentNotFoundException("Payment not found"));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PAIEMENTS D'UN PASSAGER
    // ─────────────────────────────────────────────────────────────────────────

    @Override
    public List<Payment> getPaymentByPassenger(String passengerId) {

        List<Payment> payments = paymentRepository.findByPassengerId(passengerId);
        if (payments.isEmpty()) {
            throw new PaymentNotFoundException("Payment not found");
        }
        return payments;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ANNULER UN PAIEMENT
    // ─────────────────────────────────────────────────────────────────────────

    @Override
    public void CancelPayment(long paymentId) {

        Payment payment = paymentRepository.findByPaymentId(paymentId)
                .orElseThrow(() -> new PaymentNotFoundException(
                        "Payment not found " + paymentId));

        payment.cancel();

        transactionRepository.findByPayment(payment).ifPresent(t -> {
            try {
                t.markFailed();
                transactionRepository.save(t);
            } catch (Exception e) {
                log.warn("[PAYMENT] Transition transaction annulation impossible : {}",
                        e.getMessage());
            }
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

    // ─────────────────────────────────────────────────────────────────────────
    // REMBOURSER UN PAIEMENT (API directe par paymentId)
    // ─────────────────────────────────────────────────────────────────────────

    @Override
    public RefundResult refundPayment(long paymentId, double amount) {

        Payment payment = paymentRepository.findByPaymentId(paymentId)
                .orElseThrow(() -> new PaymentNotFoundException(
                        "Payment not found " + paymentId));

        if (!payment.getStatus().equals(PaymentStatus.COMPLETED)) {
            throw new InvalidPaymentOperationException(
                    "Only payment with status COMPLETED can be refunded");
        }

        if (amount <= 0.0 || amount > payment.getAmount()) {
            throw new InvalidAmountException("Invalid amount: " + amount);
        }

        PaymentMethod adapter = factory.getStrategy(payment.getPaymentMethodType());
        if (!(adapter instanceof Refundable)) {
            throw new NonRefundablePaymentMethodException(
                    "This payment type doesn't support the refund");
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
        } else {
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

        return response;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TIMEOUT D'UN PAIEMENT
    // ─────────────────────────────────────────────────────────────────────────

    @Override
    public void paymentTimeout(long paymentId) {

        Payment payment = paymentRepository.findByPaymentId(paymentId)
                .orElseThrow(() -> new PaymentNotFoundException(
                        "Payment not found " + paymentId));

        if (payment.getStatus() != PaymentStatus.PROCESSING) {
            log.warn("[TIMEOUT] Statut non PROCESSING ({}) — paymentId={} ignoré",
                    payment.getStatus(), paymentId);
            return;
        }

        transactionRepository.findByPayment(payment).ifPresent(t -> {
            try {
                if (t.getStatus() == TransactionStatus.INITIATED) {
                    t.authorize();
                }
                t.timeout();
                transactionRepository.save(t);
            } catch (Exception e) {
                log.warn("[TIMEOUT] Transition transaction impossible : {}", e.getMessage());
            }
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

        log.info("[PAYMENT] ⏱ payment.failed (timeout) publié — paymentId={} bookingId={}",
                payment.getPaymentId(), payment.getBookingId());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TOUS LES PAIEMENTS
    // ─────────────────────────────────────────────────────────────────────────

    @Override
    public List<Payment> getAllPayments() {

        List<Payment> all = paymentRepository.findAll();
        if (all.isEmpty()) {
            throw new PaymentNotFoundException("No payments yet");
        }
        return all;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // HELPER — statuts terminaux
    // ─────────────────────────────────────────────────────────────────────────

    private boolean isTerminalStatus(PaymentStatus status) {
        return status == PaymentStatus.COMPLETED
                || status == PaymentStatus.FAILED
                || status == PaymentStatus.CANCELLED
                || status == PaymentStatus.EXPIRED
                || status == PaymentStatus.REFUNDED
                || status == PaymentStatus.PARTIALLY_REFUNDED;
    }
}
