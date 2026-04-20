package com.njila.njila_payement_service.infrastructure.repositories;

import com.njila.njila_payement_service.domain.entities.Payment;
import com.njila.njila_payement_service.domain.enumerations.PaymentStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PaymentRepository extends JpaRepository<Payment, Long> {

    
    Optional<Payment> findByPaymentId(long paymentId);

    Optional<Payment> findPaymentByBookingId(long bookingId);

    Optional<Payment> findPaymentByIdempotencyKeyValue(String idempotencyKeyValue);

    List<Payment> findByPassengerId(long passengerId);

    List<Payment> findByStatusAndUpdatedAtBefore(PaymentStatus status, LocalDateTime updatedAt);

}
