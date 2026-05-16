package com.njila.njila_booking_service.repository;

import com.njila.njila_booking_service.domain.entity.Paiement;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface PaiementRepository extends JpaRepository<Paiement, Long> {
    Optional<Paiement> findByReservationId(Long reservationId);
    Optional<Paiement> findByReferenceTransaction(String referenceTransaction);
}