package com.njila.njila_user_service.entity;

import com.njila.njila_user_service.enums.Role;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "voyageurs")
@PrimaryKeyJoinColumn(name = "id_user")
@Getter
@Setter
@NoArgsConstructor
public class Voyageur extends UserProfile {

    @Column(name = "historique_resa", columnDefinition = "TEXT")
    private String historiqueResa;

    public Voyageur(UUID idUser, String name, String surname, String email,
                    String phone, String adresse, String photoProfil,
                    boolean isActive, LocalDateTime dateInscription,
                    LocalDateTime derniereConnexion, LocalDateTime updatedAt,
                    String historiqueResa) {
        super(idUser, name, surname, email, phone, adresse, photoProfil,
              Role.VOYAGEUR, isActive, dateInscription, derniereConnexion, updatedAt, null);
        this.historiqueResa = historiqueResa;
    }
}