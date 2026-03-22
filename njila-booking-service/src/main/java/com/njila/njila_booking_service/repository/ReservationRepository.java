package com.njila.njila_booking_service.repository;

import com.njila.njila_booking_service.domain.entity.Reservation;
import com.njila.njila_booking_service.domain.enums.StatutReservation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ReservationRepository extends JpaRepository<Reservation, Long> {
    List<Reservation> findByIdVoyage(Long idVoyage);
    List<Reservation> findByIdVoyageur(Long idVoyageur);
    List<Reservation> findByIdVoyageAndStatut(Long idVoyage, StatutReservation statut);
    boolean existsByIdVoyageurAndIdVoyageAndStatutIn(Long idVoyageur, Long idVoyage, List<StatutReservation> statuts);
}