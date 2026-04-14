package com.njila.njila_booking_service.domain.entity.projection;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.*;

@Entity
@Table(name = "agences_projection")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AgenceData {
    @Id
    private String id; // This will map to agence_id (UUID)
    private String nom;
    private String adresse;
    private String telephone;
    private String emailOfficiel;
    private String statutGlobal;
    private String logoUrl;
}
