package com.njila.njila_user_service.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;


@Entity
@Table(
    name = "avis",
    indexes = {
        @Index(name = "idx_avis_agence",  columnList = "agence_id"),
        @Index(name = "idx_avis_auteur",  columnList = "auteur_id"),
        @Index(name = "idx_avis_visible", columnList = "visible")
    },
    uniqueConstraints = {
        @UniqueConstraint(
            name        = "uk_avis_auteur_agence",
            columnNames = {"auteur_id", "agence_id"}
        )
    }
)
@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Avis {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    // ── Auteur ─────────────────────────────────────────────────────────────
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "auteur_id", nullable = false)
    private UserProfile auteur;

    // ── Cible ──────────────────────────────────────────────────────────────
    @Column(name = "agence_id", nullable = false)
    private UUID agenceId;

    @Column(name = "agence_nom", length = 200)
    private String agenceNom;

    // ── Contenu ────────────────────────────────────────────────────────────
    @Column(name = "note", nullable = false)
    private int note;

    @Column(name = "commentaire", columnDefinition = "TEXT")
    private String commentaire;

    // ── Modération ─────────────────────────────────────────────────────────
    @Column(name = "visible", nullable = false)
    @Builder.Default
    private boolean visible = true;

    @Column(name = "signale", nullable = false)
    @Builder.Default
    private boolean signale = false;

    // ── Audit ──────────────────────────────────────────────────────────────
    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}