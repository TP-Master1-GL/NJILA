package com.njila.repository;

import com.njila.entity.HistoriqueReservation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface HistoriqueReservationRepository extends JpaRepository<HistoriqueReservation, Long> {

    List<HistoriqueReservation> findByReservationIdOrderByDateActionDesc(Long reservationId);
}