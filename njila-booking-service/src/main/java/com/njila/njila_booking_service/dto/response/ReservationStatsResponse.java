package com.njila.njila_booking_service.dto.response;

import lombok.Builder;
import lombok.Data;

/**
 * Réponse pour GET /api/bookings/stats/{filialeId}
 *
 * Contient des métriques agrégées calculées côté service,
 * conformément à la spec S6 (Manager local / Global).
 */
@Data
@Builder
public class ReservationStatsResponse {

    /** Identifiant de la filiale concernée */
    private Long   filialeId;

    /** Nombre total de réservations pour cette filiale */
    private long   totalReservations;

    /** Réservations confirmées ou payées */
    private long   reservationsConfirmees;

    /** Réservations annulées */
    private long   reservationsAnnulees;

    /** Réservations en attente de paiement */
    private long   reservationsEnAttente;

    /** Réservations dont les passagers sont déjà embarqués */
    private long   reservationsEmbarquees;

    /** Nombre total de places vendues (toutes réservations actives) */
    private long   totalPlacesVendues;

    /** Chiffre d'affaires total (réservations payées uniquement) */
    private double chiffreAffairesTotal;

    /** Taux de remplissage = confirmées / total (en %) */
    private double tauxConversion;
}