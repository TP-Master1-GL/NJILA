package com.njila.njila_booking_service.dto.request;

import com.njila.njila_booking_service.domain.enums.CanalReservation;
import jakarta.validation.constraints.*;
import lombok.Data;
import java.util.List;

@Data
public class CreerReservationRequest {

    @NotNull
    private Long idVoyage;

    @NotNull
    private Long idVoyageur;   // Responsable du groupe (celui avec la CNI)

    @NotNull @Min(1) @Max(50)
    private Integer nombrePlaces;

    @NotNull
    private CanalReservation canal;

    @NotBlank
    private String codeAgence;

    @NotBlank
    private String codeFiliale;

    private Long idGuichetier;

    // Type de tarification
    @NotNull
    private TypeTarif typeTarif;   // STANDARD, GROUPE, PROMO

    // Membres du groupe (null si réservation individuelle)
    // Le responsable (idVoyageur) n'est pas dans cette liste
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