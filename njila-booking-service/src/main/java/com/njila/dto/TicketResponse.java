package com.njila.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class TicketResponse {
    private Long id;
    private String numeroTicket;
    private String qrCode;
    private String origine;
    private String destination;
    private LocalDateTime dateDepart;
    private String nomVoyageur;
    private String nomAgence;
    private double montant;
    private String urlPdf;
    private LocalDateTime dateEmission;
}