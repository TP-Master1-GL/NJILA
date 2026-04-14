package com.njila.njila_user_service.entity;

import com.njila.njila_user_service.enums.Role;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "chauffeurs")
@PrimaryKeyJoinColumn(name = "id_user")
@Getter
@Setter
@NoArgsConstructor
public class Chauffeur extends EmployeFiliale {

    @Column(name = "numero_permis", length = 50)
    private String numeroPermis;

    @Column(name = "id_voyage_actuel")
    private UUID idVoyageActuel;

    @Column(name = "disponible")
    private Boolean disponible;

    @Builder
    public Chauffeur(UUID idUser, String name, String surname, String email,
                     String phone, String adresse, String photoProfil,
                     boolean isActive, LocalDateTime dateInscription,
                     LocalDateTime derniereConnexion, LocalDateTime updatedAt,
                     UUID agenceId, UUID filialeId, LocalDateTime dateEmbauche,
                     String numeroPermis, UUID idVoyageActuel, Boolean disponible) {
        super(idUser, name, surname, email, phone, adresse, photoProfil,
              Role.CHAUFFEUR, isActive, dateInscription, derniereConnexion, updatedAt,
              agenceId, filialeId, dateEmbauche);
        this.numeroPermis = numeroPermis;
        this.idVoyageActuel = idVoyageActuel;
        this.disponible = disponible != null ? disponible : true;
    }
}