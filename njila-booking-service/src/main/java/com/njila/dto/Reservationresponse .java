package com.njila.dto;


import com.njila.booking.enums.ClasseBus;
import com.njila.booking.enums.StatutReservation;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
public class ReservationResponse {

    private Long id;
    private String codeReservation;
    private Long voyageId;
    private Long voyageurId;
    private Long agenceId;
    private int nombrePlaces;
    private double prixTotal;
    private StatutReservation statut;
    private ClasseBus classeBus;
    private String codePromo;
    private List<PlaceReserveeResponse> placesReservees;
    private TicketResponse ticket;
    private LocalDateTime dateCreation;
    private LocalDateTime dateExpiration;
}

