package com.njila.njila_user_service.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;


@Entity
@Table(
    name = "filiales",
    indexes = {
        @Index(name = "idx_filiales_agence", columnList = "agence_id")
    }
)
@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Filiale {

    @Id
    @Column(name = "id_filiale", nullable = false, updatable = false)
    private UUID idFiliale;

    @Column(name = "nom", nullable = false, length = 200)
    private String nom;

    @Column(name = "adresse", length = 500)
    private String adresse;

    @Column(name = "ville", length = 100)
    private String ville;

    @Column(name = "agence_id", nullable = false)
    private UUID agenceId;

    @Column(name = "code", length = 50)
    private String code;

    @Column(name = "telephone", length = 50)
    private String telephone;

    @Column(name = "email", length = 200)
    private String email;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private boolean isActive = true;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}