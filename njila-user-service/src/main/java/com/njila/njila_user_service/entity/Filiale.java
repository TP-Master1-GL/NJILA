package com.njila.njila_user_service.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Filiale d'une agence enregistrée dans le user-service.
 * Créée via l'événement RabbitMQ filiale.created publié par le fleet-management-service.
 *
 * Lors de la création, on vérifie que l'agence parente existe déjà en base.
 * Utilisée pour valider l'existence d'une filiale lors de la création d'un compte staff.
 */
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

    /** Référence vers l'agence parente — doit exister en base avant création */
    @Column(name = "agence_id", nullable = false)
    private UUID agenceId;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private boolean isActive = true;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}