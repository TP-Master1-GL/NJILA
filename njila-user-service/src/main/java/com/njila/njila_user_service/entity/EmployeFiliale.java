package com.njila.njila_user_service.entity;

import com.njila.njila_user_service.enums.Role;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "employes_filiale")
@PrimaryKeyJoinColumn(name = "id_user")
@Getter
@Setter
@NoArgsConstructor
public abstract class EmployeFiliale extends AgentFiliale {

    @Column(name = "date_embauche")
    private LocalDateTime dateEmbauche;

    public EmployeFiliale(UUID idUser, String name, String surname, String email,
                          String phone, String adresse, String photoProfil,
                          Role role, boolean isActive, LocalDateTime dateInscription,
                          LocalDateTime derniereConnexion, LocalDateTime updatedAt,
                          UUID agenceId, UUID filialeId, LocalDateTime dateEmbauche) {
        super(idUser, name, surname, email, phone, adresse, photoProfil,
              role, isActive, dateInscription, derniereConnexion, updatedAt,
              agenceId, filialeId);
        this.dateEmbauche = dateEmbauche;
    }
}