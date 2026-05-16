package com.njila.njila_booking_service.dto.response;

import com.njila.njila_booking_service.domain.enums.CanalReservation;
import com.njila.njila_booking_service.domain.enums.StatutReservation;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

/**
 * Réponse complète pour le manifeste des passagers d'un voyage.
 *
 * <p>Inclut :</p>
 * <ul>
 *   <li>Le résumé d'occupation (places totales, occupées, libres)</li>
 *   <li>Les numéros de sièges déjà occupés</li>
 *   <li>La liste détaillée de chaque passager avec son siège et son canal de paiement</li>
 * </ul>
 */
@Data
@Builder
public class VoyagePassagersResponse {

    /** Identifiant du voyage concerné. */
    private String voyageId;

    /** Capacité totale du bus. */
    private int capaciteTotale;

    /** Nombre de places effectivement occupées (passagers actifs). */
    private long placesOccupees;

    /** Nombre de places encore disponibles. */
    private long placesLibres;

    /** Ensemble des numéros de sièges déjà occupés (triés). */
    private Set<Integer> siegesOccupes;

    /** Nombre de passagers ayant réservé et payé via le canal WEB (mobile money). */
    private long nbPassagersWeb;

    /** Nombre de passagers ayant réservé et payé via le canal GUICHET (espèces). */
    private long nbPassagersGuichet;

    /** Liste complète des passagers, triée par numéro de siège croissant. */
    private List<PassagerDetail> passagers;

    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Détail d'un passager / d'une place réservée.
     */
    @Data
    @Builder
    public static class PassagerDetail {

        // ── Siège & identité ─────────────────────────────────────────────────

        /** Numéro du siège attribué dans le bus. */
        private Integer numeroSiege;

        /** Nom complet du passager tel qu'enregistré lors de la réservation. */
        private String nomPassager;

        /** Téléphone du passager. */
        private String telephonePassager;

        /** {@code true} si le passager a déclaré un bagage. */
        private boolean aBagage;

        /**
         * {@code true} si ce passager est le responsable de la réservation
         * (celui qui a effectué la démarche, par opposition aux membres d'un groupe).
         */
        private boolean estResponsable;

        /** Prix unitaire payé pour ce siège (dans la devise de la réservation). */
        private double prixUnitaire;

        /** Identifiant utilisateur du passager (null pour les membres de groupe sans compte). */
        private String idVoyageur;

        // ── Réservation parente ──────────────────────────────────────────────

        /** Identifiant de la réservation à laquelle cette place appartient. */
        private Long reservationId;

        /** Statut courant de la réservation (PAYEE, CONFIRMEE, EMBARQUEE…). */
        private StatutReservation statutReservation;

        /**
         * Canal utilisé pour cette réservation.
         * <ul>
         *   <li>{@code WEB}     → paiement en ligne via mobile money</li>
         *   <li>{@code GUICHET} → paiement en espèces au comptoir</li>
         * </ul>
         */
        private CanalReservation canal;

        /** Libellé lisible du canal : {@code "En ligne (mobile money)"} ou {@code "Guichet (espèces)"}. */
        private String canalLibelle;

        /** Montant total de la réservation parente (peut couvrir plusieurs places). */
        private double montantTotal;

        /** Devise de la réservation (ex : {@code "XAF"}). */
        private String devise;

        /** Code de l'agence. */
        private String codeAgence;

        /** Code de la filiale. */
        private String codeFiliale;

        /** Date et heure à laquelle la réservation a été créée. */
        private LocalDateTime dateReservation;
    }
}
