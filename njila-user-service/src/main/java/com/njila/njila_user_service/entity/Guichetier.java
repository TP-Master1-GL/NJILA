package com.njila.njila_user_service.entity;

import com.njila.njila_user_service.enums.Role;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "guichetiers")
@PrimaryKeyJoinColumn(name = "id_user")
@Getter
@Setter
@NoArgsConstructor
public class Guichetier extends EmployeFiliale {

    @Column(name = "poste", length = 100)
    private String poste;

    @Builder
    public Guichetier(UUID idUser, String name, String surname, String email,
                      String phone, String adresse, String photoProfil,
                      boolean isActive, LocalDateTime dateInscription,
                      LocalDateTime derniereConnexion, LocalDateTime updatedAt,
                      UUID agenceId, UUID filialeId, LocalDateTime dateEmbauche,
                      String poste) {
        super(idUser, name, surname, email, phone, adresse, photoProfil,
              Role.GUICHETIER, isActive, dateInscription, derniereConnexion, updatedAt,
              agenceId, filialeId, dateEmbauche);
        this.poste = poste;
    }
}