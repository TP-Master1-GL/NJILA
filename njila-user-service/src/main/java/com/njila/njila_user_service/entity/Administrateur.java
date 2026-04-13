package com.njila.njila_user_service.entity;

import com.njila.njila_user_service.enums.Role;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "administrateurs")
@PrimaryKeyJoinColumn(name = "id_user")
@Getter
@Setter
@NoArgsConstructor
public class Administrateur extends UserProfile {

    public Administrateur(UUID idUser, String name, String surname, String email,
                          String phone, String adresse, String photoProfil,
                          boolean isActive, LocalDateTime dateInscription,
                          LocalDateTime derniereConnexion, LocalDateTime updatedAt) {
        super(idUser, name, surname, email, phone, adresse, photoProfil,
              Role.ADMINISTRATEUR, isActive, dateInscription, derniereConnexion, updatedAt, null);
    }
}