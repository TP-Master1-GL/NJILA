package com.njila.njila_booking_service.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

/**
 * Corps de la requête pour valider un billet au départ.
 * UC-B7 — Gérer les départs.
 */
@Data
public class ValiderBilletDepartRequest {

    /** Numéro du billet à valider (électronique ou embarquement) */
    @NotBlank
    private String numeroBillet;

    /** Identifiant du manager local qui supervise le départ */
    @NotNull
    private Long idManager;
}