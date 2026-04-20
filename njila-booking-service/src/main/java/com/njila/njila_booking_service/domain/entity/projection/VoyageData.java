package com.njila.njila_booking_service.domain.entity.projection;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "voyages_projection")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class VoyageData {
    @Id
    private String id; // map to voyage_id (UUID)
    private String origine;
    private String destination;
    private LocalDateTime dateHeureDepart;
    private Double prix;
    private Integer placesDisponibles;
    private String immatriculationBus;
    private String typeVoyage;
    private String status;
    private String codeAgence;
    private String codeFiliale;
}
