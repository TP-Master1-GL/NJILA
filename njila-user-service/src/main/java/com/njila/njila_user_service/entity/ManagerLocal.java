package com.njila.njila_user_service.entity;

import com.njila.njila_user_service.enums.Role;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "managers_local")
@PrimaryKeyJoinColumn(name = "id_user")
@Getter
@Setter
@NoArgsConstructor
public class ManagerLocal extends AgentFiliale {

    @Builder
    public ManagerLocal(UUID idUser, String name, String surname, String email,
                        String phone, String adresse, String photoProfil,
                        boolean isActive, LocalDateTime dateInscription,
                        LocalDateTime derniereConnexion, LocalDateTime updatedAt,
                        UUID agenceId, UUID filialeId) {
        super(idUser, name, surname, email, phone, adresse, photoProfil,
              Role.MANAGER_LOCAL, isActive, dateInscription, derniereConnexion, updatedAt,
              agenceId, filialeId);
    }
}