package com.njila.njila_booking_service.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ConfirmerReservationRequest {

    @NotBlank
    private String idGuichetier;

    @NotBlank
    private String numeroTicketElectronique;
}