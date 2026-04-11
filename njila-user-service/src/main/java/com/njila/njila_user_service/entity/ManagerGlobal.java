package com.njila.njila_user_service.entity;

import com.njila.njila_user_service.enums.Role;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "managers_global")
@PrimaryKeyJoinColumn(name = "id_user")
@Getter
@Setter
@NoArgsConstructor
public class ManagerGlobal extends UserProfile {

    @Column(name = "agence_id", nullable = false)
    private UUID agenceId;

    @Builder
    public ManagerGlobal(UUID idUser, String name, String surname, String email,
                         String phone, String adresse, String photoProfil,
                         boolean isActive, LocalDateTime dateInscription,
                         LocalDateTime derniereConnexion, LocalDateTime updatedAt,
                         UUID agenceId) {
        super(idUser, name, surname, email, phone, adresse, photoProfil,
              Role.MANAGER_GLOBAL, isActive, dateInscription, derniereConnexion, updatedAt, null);
        this.agenceId = agenceId;
    }
}