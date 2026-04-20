package com.njila.njila_booking_service.domain.entity.projection;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.*;

@Entity
@Table(name = "users_projection")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserData {
    @Id
    private String id; // map to userId (UUID)
    private String nom;
    private String prenom; // maps to surname
    private String telephone;
    private String email;
    private String adresse;
    private String photoUrl;
    private String role;
    private String agenceId;
    private String filialeId;
}
