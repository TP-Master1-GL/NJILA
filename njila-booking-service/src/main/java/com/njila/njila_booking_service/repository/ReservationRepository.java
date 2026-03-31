package com.njila.njila_booking_service.repository;

import com.njila.njila_booking_service.domain.entity.Reservation;
import com.njila.njila_booking_service.domain.enums.StatutReservation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ReservationRepository extends JpaRepository<Reservation, Long> {

    List<Reservation> findByIdVoyage(Long idVoyage);

    List<Reservation> findByIdVoyageur(Long idVoyageur);

    List<Reservation> findByIdVoyageAndStatut(Long idVoyage, StatutReservation statut);

    boolean existsByIdVoyageurAndIdVoyageAndStatutIn(
            Long idVoyageur, Long idVoyage, List<StatutReservation> statuts);

    // ─────────────────────────────────────────────────────────────────────────
    // Requêtes pour les stats filiale — GET /api/bookings/stats/{filialeId}
    // ─────────────────────────────────────────────────────────────────────────

    /** Toutes les réservations d'une filiale, identifiée par son code */
    List<Reservation> findByCodeFiliale(String codeFiliale);

    /** Réservations d'une filiale filtrées par statut */
    List<Reservation> findByCodeFilialeAndStatut(
            String codeFiliale, StatutReservation statut);

    /**
     * Compte agrégé par statut pour une filiale donnée.
     * Retourne une projection [statut, count] utilisée pour construire
     * le ReservationStatsResponse sans charger toutes les entités.
     */
    @Query("""
            SELECT r.statut AS statut, COUNT(r) AS total
            FROM Reservation r
            WHERE r.codeFiliale = :codeFiliale
            GROUP BY r.statut
            """)
    List<StatutCount> countByStatutForFiliale(@Param("codeFiliale") String codeFiliale);

    /**
     * Chiffre d'affaires d'une filiale (réservations PAYEE + CONFIRMEE + EMBARQUEE).
     */
    @Query("""
            SELECT COALESCE(SUM(r.montantTotal), 0.0)
            FROM Reservation r
            WHERE r.codeFiliale = :codeFiliale
            AND r.statut IN ('PAYEE', 'CONFIRMEE', 'EMBARQUEE')
            """)
    double sumMontantByCodeFiliale(@Param("codeFiliale") String codeFiliale);

    /**
     * Nombre total de places vendues pour une filiale.
     */
    @Query("""
            SELECT COALESCE(SUM(r.nombrePlaces), 0)
            FROM Reservation r
            WHERE r.codeFiliale = :codeFiliale
            AND r.statut IN ('PAYEE', 'CONFIRMEE', 'EMBARQUEE')
            """)
    long sumPlacesVenduesByCodeFiliale(@Param("codeFiliale") String codeFiliale);

    // ─────────────────────────────────────────────────────────────────────────
    // Projection interface pour les aggrégats
    // ─────────────────────────────────────────────────────────────────────────

    interface StatutCount {
        StatutReservation getStatut();
        long getTotal();
    }
}