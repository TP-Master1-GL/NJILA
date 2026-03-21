package com.njila.repository;


import com.njila.entity.Reservation;
import com.njila.enums.StatutReservation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
 
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
 
@Repository
public interface ReservationRepository extends JpaRepository<Reservation, Long> {
 
    Optional<Reservation> findByCodeReservation(String codeReservation);
 
    List<Reservation> findByVoyageurId(Long voyageurId);
 
    List<Reservation> findByVoyageId(Long voyageId);
 
    List<Reservation> findByVoyageIdAndStatut(Long voyageId, StatutReservation statut);
 
    /**
     * Récupère toutes les réservations EN_ATTENTE dont le délai de paiement est dépassé.
     * Utilisé par le job d'expiration planifié toutes les 5 minutes.
     */
    @Query("SELECT r FROM Reservation r WHERE r.statut = 'EN_ATTENTE' AND r.dateExpiration < :now")
    List<Reservation> findReservationsExpirees(@Param("now") LocalDateTime now);
 
    /**
     * Compte les places actuellement occupées sur un voyage (EN_ATTENTE + CONFIRMEE).
     * Utile pour recalcul de disponibilité.
     */
    @Query("SELECT COALESCE(SUM(r.nombrePlaces), 0) FROM Reservation r " +
           "WHERE r.voyageId = :voyageId AND r.statut IN ('EN_ATTENTE', 'CONFIRMEE')")
    Integer countPlacesReserveesParVoyage(@Param("voyageId") Long voyageId);
}