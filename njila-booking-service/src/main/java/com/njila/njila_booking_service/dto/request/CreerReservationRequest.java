package com.njila.njila_booking_service.dto.request;

import com.njila.njila_booking_service.domain.enums.CanalReservation;
import jakarta.validation.constraints.*;
import lombok.Data;
import java.util.List;

@Data
public class CreerReservationRequest {

    @NotBlank
    private String idVoyage;

    @NotBlank
    private String idVoyageur;

    @NotBlank
    private String nomVoyageur;

    @NotBlank
    private String prenomVoyageur;

    private String telephoneVoyageur;
    private String emailVoyageur;

    @NotNull @Min(1) @Max(50)
    private Integer nombrePlaces;

    /**
     * Numéros de sièges choisis par le client (1..capacité du bus).
     * Optionnel : si null/vide, attribution automatique par le service.
     * Si renseigné, taille doit être égale à nombrePlaces.
     */
    private List<@Min(1) Integer> siegesDemandes;

    @NotNull
    private CanalReservation canal;

    @NotBlank
    private String codeAgence;

    @NotBlank
    private String codeFiliale;

    private String idGuichetier;
    private String devise;

    @NotNull
    private TypeTarif typeTarif;

    /**
     * Type de paiement utilisé pour cette réservation.
     * Valeurs attendues par le payment-service : MOBILE_MONEY, CASH, CARD.
     * Ignoré pour le canal GUICHET (paiement espèces géré localement).
     * Défaut appliqué côté service : MOBILE_MONEY.
     */
    private String paymentMethodType;

    /**
     * Numéro Mobile Money saisi par le client sur le frontend.
     * Utilisé par le payment-service pour initier la transaction USSD push.
     * Obligatoire pour le canal WEB avec paymentMethodType=MOBILE_MONEY.
     * Ignoré pour le canal GUICHET.
     */
    private String telephonePaiement;

    /**
     * Opérateur Mobile Money choisi par le client.
     * Valeurs attendues : ORANGE_MONEY, MTN_MONEY.
     * Transmis dans BookingCreatedEvent pour que le payment-service
     * sélectionne le bon opérateur lors de l'initiation du paiement.
     */
    private String operateurPaiement;

    /**
     * Membres additionnels du groupe (hors passager responsable).
     * Vide ou null pour une réservation solo.
     */
    private List<MembreGroupeRequest> membresGroupe;

    public enum TypeTarif {
        STANDARD, GROUPE, PROMO
    }

    @Data
    public static class MembreGroupeRequest {
        @NotBlank
        private String nom;
        @NotBlank
        private String prenom;
        private String telephone;
        private Boolean aBagage;
    }
}
