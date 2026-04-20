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
    private String id; // map to filiale_id (UUID)
    private String agenceId;
    private String nom;
    private String code;
    private String ville;
    private String adresse;
    private String telephone;
    private String email;
}
