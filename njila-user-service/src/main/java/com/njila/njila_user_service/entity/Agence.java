package com.njila.njila_user_service.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Agence mère enregistrée dans le user-service.
 * Créée via l'événement RabbitMQ agence.created publié par le fleet-management-service.
 *
 * Utilisée pour valider l'existence d'une agence lors de la création d'un compte staff
 * ou d'une filiale.
 */
@Entity
@Table(name = "agences")
@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Agence {

    @Id
    @Column(name = "id_agence", nullable = false, updatable = false)
    private UUID idAgence;

    @Column(name = "nom", nullable = false, length = 200)
    private String nom;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private boolean isActive = true;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}