package com.njila.dto;


import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class PlaceReserveeResponse {
    private Long id;
    private int numeroPlace;
    private String nomPassager;
    private String cniPassager;
}

