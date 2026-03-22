package com.njila.njila_booking_service.dto.response;

import com.njila.njila_booking_service.domain.enums.StatutTicket;
import lombok.Builder;
import lombok.Data;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data @Builder
public class TicketResponse {
    private Long         id;
    private String       numeroTicket;
    private String       type;            // WEB ou EMB
    private String       nomVoyageur;
    private String       origine;
    private String       destination;
    private LocalDate    dateDepart;
    private String       immatriculationBus;
    private StatutTicket statut;
    private LocalDateTime dateEmission;
    private String       cheminPdf;       // null si billet embarquement
}