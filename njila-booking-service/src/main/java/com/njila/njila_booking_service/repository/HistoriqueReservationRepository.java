package com.njila.njila_booking_service.repository;

import com.njila.njila_booking_service.domain.entity.HistoriqueReservation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface HistoriqueReservationRepository extends JpaRepository<HistoriqueReservation, Long> {
    List<HistoriqueReservation> findByReservationIdOrderByDateActionDesc(Long reservationId);
}