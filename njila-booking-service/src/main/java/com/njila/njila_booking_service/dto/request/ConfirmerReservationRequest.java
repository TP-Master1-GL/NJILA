package com.njila.njila_booking_service.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class ConfirmerReservationRequest {

    @NotNull
    private Long idGuichetier;

    @NotBlank
    private String numeroTicketElectronique;
}