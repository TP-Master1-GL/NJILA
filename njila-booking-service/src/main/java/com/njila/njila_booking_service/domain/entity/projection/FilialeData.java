package com.njila.njila_booking_service.domain.entity.projection;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.*;

@Entity
@Table(name = "filiales_projection")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FilialeData {
    @Id
    private String code;
    private String nom;
    private String pays;
}
