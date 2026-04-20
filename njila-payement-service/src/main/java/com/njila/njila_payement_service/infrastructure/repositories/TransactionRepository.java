package com.njila.njila_payement_service.infrastructure.repositories;

import com.njila.njila_payement_service.domain.entities.Payment;
import com.njila.njila_payement_service.domain.entities.Transaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository

public interface TransactionRepository extends JpaRepository<Transaction, UUID> {

    Optional<Transaction> findByTransactionId(long transactionId);

    Optional<Transaction> findByProvidedReference(String providedReferenceId);

    Optional<Transaction> findByPayment(Payment payment);

    List<Transaction> findByPayment_PaymentId(long paymentId);
}
