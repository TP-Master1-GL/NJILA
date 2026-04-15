package com.njila.njila_booking_service.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

/**
 * Corps de la requête pour confirmer une réservation en attente
 * dont le paiement est réglé en espèces au guichet.
 */
@Data
public class ConfirmerPaiementEspecesRequest {

    /** Identifiant du guichetier qui encaisse */
    @NotNull
    private Long idGuichetier;

    /** Montant encaissé en espèces (pour traçabilité) */
    @NotNull
    private Double montantEncaisse;
}