package com.njila.njila_booking_service.repository;

import com.njila.njila_booking_service.domain.entity.Reservation;
import com.njila.njila_booking_service.domain.enums.CanalReservation;
import com.njila.njila_booking_service.domain.enums.StatutReservation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

@Repository
public interface ReservationRepository extends JpaRepository<Reservation, Long> {

    List<Reservation> findByIdVoyage(String idVoyage);

    List<Reservation> findByIdVoyageur(String idVoyageur);

    List<Reservation> findByStatutAndCanalAndDateReservationBefore(
            StatutReservation statut,
            CanalReservation canal,
            LocalDateTime before);

    // ─── Sièges occupés ───────────────────────────────────────────────────────

    @Query("""
        SELECT p.numeroSiege
        FROM PlaceReservee p
        WHERE p.reservation.idVoyage = :idVoyage
          AND p.reservation.statut NOT IN (:statutAnnulee, :statutExpiree)
        """)
    Set<Integer> findSiegesOccupes(
            @Param("idVoyage") String idVoyage,
            @Param("statutAnnulee") StatutReservation statutAnnulee,
            @Param("statutExpiree") StatutReservation statutExpiree);

    // ─── Passagers d'un voyage ────────────────────────────────────────────────

    /**
     * Retourne la liste complète des passagers (PlaceReservee) pour un voyage donné,
     * en excluant les réservations annulées ou expirées.
     * Chaque projection inclut :
     *   - les informations du passager (nom, téléphone, siège, bagage, responsable)
     *   - les informations de la réservation parente (id, statut, canal, montant, devise,
     *     codeAgence, codeFiliale, idVoyageur)
     * Le champ {@code canal} permet de distinguer les passagers ayant payé via WEB
     * (mobile money) de ceux passés en GUICHET (espèces).
     */
    @Query("""
        SELECT
            p.id                          AS placeId,
            p.numeroSiege                 AS numeroSiege,
            p.nomPassager                 AS nomPassager,
            p.telephonePassager           AS telephonePassager,
            p.aBagage                     AS aBagage,
            p.estResponsable              AS estResponsable,
            p.prixUnitaire                AS prixUnitaire,
            p.idVoyageur                  AS idVoyageur,
            r.id                          AS reservationId,
            r.statut                      AS statutReservation,
            r.canal                       AS canal,
            r.montantTotal                AS montantTotal,
            r.devise                      AS devise,
            r.codeAgence                  AS codeAgence,
            r.codeFiliale                 AS codeFiliale,
            r.dateReservation             AS dateReservation
        FROM PlaceReservee p
        JOIN p.reservation r
        WHERE r.idVoyage = :idVoyage
          AND r.statut NOT IN (:statutAnnulee, :statutExpiree)
        ORDER BY p.numeroSiege ASC
        """)
    List<PassagerProjection> findPassagersByVoyage(
            @Param("idVoyage") String idVoyage,
            @Param("statutAnnulee") StatutReservation statutAnnulee,
            @Param("statutExpiree") StatutReservation statutExpiree);

    /**
     * Compte le nombre total de places effectivement occupées pour un voyage,
     * en excluant les réservations annulées ou expirées.
     */
    @Query("""
        SELECT COUNT(p)
        FROM PlaceReservee p
        WHERE p.reservation.idVoyage = :idVoyage
          AND p.reservation.statut NOT IN (:statutAnnulee, :statutExpiree)
        """)
    long countPlacesOccupees(
            @Param("idVoyage") String idVoyage,
            @Param("statutAnnulee") StatutReservation statutAnnulee,
            @Param("statutExpiree") StatutReservation statutExpiree);

    // ─── Stats par statut (filiale) ───────────────────────────────────────────

    @Query("""
        SELECT r.statut AS statut, COUNT(r) AS total
        FROM Reservation r
        WHERE r.codeFiliale = :codeFiliale
          AND r.statut NOT IN (:statutEnAttente, :statutExpiree)
        GROUP BY r.statut
        """)
    List<StatutCount> countByStatutForFiliale(
            @Param("codeFiliale") String codeFiliale,
            @Param("statutEnAttente") StatutReservation statutEnAttente,
            @Param("statutExpiree") StatutReservation statutExpiree);

    @Query("""
        SELECT COALESCE(SUM(r.montantTotal), 0)
        FROM Reservation r
        WHERE r.codeFiliale = :codeFiliale
          AND r.statut IN (:s1, :s2, :s3)
        """)
    double sumMontantByCodeFiliale(
            @Param("codeFiliale") String codeFiliale,
            @Param("s1") StatutReservation s1,
            @Param("s2") StatutReservation s2,
            @Param("s3") StatutReservation s3);

    @Query("""
        SELECT COALESCE(SUM(r.nombrePlaces), 0)
        FROM Reservation r
        WHERE r.codeFiliale = :codeFiliale
          AND r.statut IN (:s1, :s2, :s3)
        """)
    long sumPlacesVenduesByCodeFiliale(
            @Param("codeFiliale") String codeFiliale,
            @Param("s1") StatutReservation s1,
            @Param("s2") StatutReservation s2,
            @Param("s3") StatutReservation s3);

    // ─── RECETTES AGENCE ──────────────────────────────────────────────────────

    /**
     * Recette totale d'une agence (tous canaux, statuts terminaux payés).
     */
    @Query("""
        SELECT COALESCE(SUM(r.montantTotal), 0)
        FROM Reservation r
        WHERE r.codeAgence = :codeAgence
          AND r.statut IN (:s1, :s2, :s3)
        """)
    double sumRecetteTotaleByAgence(
            @Param("codeAgence") String codeAgence,
            @Param("s1") StatutReservation s1,
            @Param("s2") StatutReservation s2,
            @Param("s3") StatutReservation s3);

    /**
     * Recette en ligne (canal WEB / paiement mobile money) d'une agence.
     */
    @Query("""
        SELECT COALESCE(SUM(r.montantTotal), 0)
        FROM Reservation r
        WHERE r.codeAgence = :codeAgence
          AND r.canal = :canal
          AND r.statut IN (:s1, :s2, :s3)
        """)
    double sumRecetteByAgenceAndCanal(
            @Param("codeAgence") String codeAgence,
            @Param("canal") CanalReservation canal,
            @Param("s1") StatutReservation s1,
            @Param("s2") StatutReservation s2,
            @Param("s3") StatutReservation s3);

    /**
     * Nombre de réservations payées par canal pour une agence (pour les stats).
     */
    @Query("""
        SELECT r.canal AS canal, COUNT(r) AS total, COALESCE(SUM(r.montantTotal), 0) AS montant
        FROM Reservation r
        WHERE r.codeAgence = :codeAgence
          AND r.statut IN (:s1, :s2, :s3)
        GROUP BY r.canal
        """)
    List<CanalCount> countAndSumByCanal(
            @Param("codeAgence") String codeAgence,
            @Param("s1") StatutReservation s1,
            @Param("s2") StatutReservation s2,
            @Param("s3") StatutReservation s3);

    // ─── RECETTES FILIALE ─────────────────────────────────────────────────────

    /**
     * Recette totale d'une filiale (tous canaux, statuts terminaux payés).
     */
    @Query("""
        SELECT COALESCE(SUM(r.montantTotal), 0)
        FROM Reservation r
        WHERE r.codeFiliale = :codeFiliale
          AND r.statut IN (:s1, :s2, :s3)
        """)
    double sumRecetteTotaleByFiliale(
            @Param("codeFiliale") String codeFiliale,
            @Param("s1") StatutReservation s1,
            @Param("s2") StatutReservation s2,
            @Param("s3") StatutReservation s3);

    /**
     * Recette par canal d'une filiale.
     */
    @Query("""
        SELECT COALESCE(SUM(r.montantTotal), 0)
        FROM Reservation r
        WHERE r.codeFiliale = :codeFiliale
          AND r.canal = :canal
          AND r.statut IN (:s1, :s2, :s3)
        """)
    double sumRecetteByFilialeAndCanal(
            @Param("codeFiliale") String codeFiliale,
            @Param("canal") CanalReservation canal,
            @Param("s1") StatutReservation s1,
            @Param("s2") StatutReservation s2,
            @Param("s3") StatutReservation s3);

    /**
     * Nombre de réservations payées par canal pour une filiale.
     */
    @Query("""
        SELECT r.canal AS canal, COUNT(r) AS total, COALESCE(SUM(r.montantTotal), 0) AS montant
        FROM Reservation r
        WHERE r.codeFiliale = :codeFiliale
          AND r.statut IN (:s1, :s2, :s3)
        GROUP BY r.canal
        """)
    List<CanalCount> countAndSumByCanalForFiliale(
            @Param("codeFiliale") String codeFiliale,
            @Param("s1") StatutReservation s1,
            @Param("s2") StatutReservation s2,
            @Param("s3") StatutReservation s3);

    // ─── Projections ──────────────────────────────────────────────────────────

    interface StatutCount {
        StatutReservation getStatut();
        long getTotal();
    }

    interface CanalCount {
        CanalReservation getCanal();
        long getTotal();
        double getMontant();
    }

    /**
     * Projection plate retournée par {@link #findPassagersByVoyage}.
     * Chaque instance représente une place réservée (un passager) avec ses
     * informations de réservation parente.
     *
     * <p>Le champ {@code canal} est la donnée clé pour distinguer :</p>
     * <ul>
     *   <li>{@code WEB}     → paiement mobile money (Orange Money / MTN Money)</li>
     *   <li>{@code GUICHET} → paiement en espèces au comptoir</li>
     * </ul>
     */
    interface PassagerProjection {

        // ── Place réservée ───────────────────────────────────────────────────
        Long    getPlaceId();
        Integer getNumeroSiege();
        String  getNomPassager();
        String  getTelephonePassager();
        Boolean getABagage();
        Boolean getEstResponsable();
        Double  getPrixUnitaire();
        String  getIdVoyageur();

        // ── Réservation parente ──────────────────────────────────────────────
        Long              getReservationId();
        StatutReservation getStatutReservation();

        /** WEB = mobile money · GUICHET = espèces */
        CanalReservation  getCanal();

        Double           getMontantTotal();
        String           getDevise();
        String           getCodeAgence();
        String           getCodeFiliale();
        java.time.LocalDateTime getDateReservation();
    }
}
