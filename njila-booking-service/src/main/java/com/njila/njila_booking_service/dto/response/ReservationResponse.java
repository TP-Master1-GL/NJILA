package com.njila.njila_booking_service.dto.response;

import com.njila.njila_booking_service.domain.enums.CanalReservation;
import com.njila.njila_booking_service.domain.enums.StatutReservation;
import lombok.Builder;
import lombok.Data;
import java.time.LocalDateTime;

@Data @Builder
public class ReservationResponse {
    private Long             id;
    private StatutReservation statut;
    private Integer          nombrePlaces;
    private Double           montantTotal;
    private CanalReservation canal;
    private Long             idVoyage;
    private Long             idVoyageur;
    private LocalDateTime    dateReservation;
    private String           codeAgence;
    private String           codeFiliale;
}