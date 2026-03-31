package com.njila.njila_user_service.entity;

import com.njila.njila_user_service.enums.Role;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Entité principale — UserProfile (diagramme UML).
 *
 * Correspondance avec auth-service NjilaUser :
 *   idUser           ↔ NjilaUser.id          (UUID partagé)
 *   name             ↔ NjilaUser.name         (prénom)
 *   surname          ↔ NjilaUser.surname      (nom)
 *   email            ↔ NjilaUser.email
 *   phone            ↔ NjilaUser.phone
 *   adresse          ↔ NjilaUser.adresse
 *   photoProfil      ↔ NjilaUser.photo_url
 *   dateInscription  ↔ NjilaUser.created_at
 *   derniereConnexion↔ NjilaUser.last_login_at
 *
 * Créé via l'événement RabbitMQ user.registered publié par l'auth-service.
 * Ne contient JAMAIS de mot de passe.
 */
@Entity
@Table(
    name = "user_profiles",
    indexes = {
        @Index(name = "idx_user_profiles_email",  columnList = "email"),
        @Index(name = "idx_user_profiles_role",   columnList = "role"),
        @Index(name = "idx_user_profiles_agence", columnList = "agence_id")
    }
)
@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserProfile {

    @Id
    @Column(name = "id_user", nullable = false, updatable = false)
    private UUID idUser;

    // ── Identité ───────────────────────────────────────────────────────────
    @Column(name = "name", nullable = false, length = 100)
    private String name;

    @Column(name = "surname", nullable = false, length = 100)
    private String surname;

    @Column(name = "email", nullable = false, unique = true, length = 200)
    private String email;

    @Column(name = "phone", length = 20)
    private String phone;

    @Column(name = "adresse", length = 500)
    private String adresse;

    @Column(name = "photo_profil", length = 500)
    private String photoProfil;

    // ── Rôle et contexte ────────────────────────────────────────────────────
    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false, length = 20)
    private Role role;

    @Column(name = "filiale_id")
    private UUID filialeId;

    @Column(name = "agence_id")
    private UUID agenceId;

    // ── Accès ──────────────────────────────────────────────────────────────
    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private boolean isActive = true;

    // ── Champs Voyageur ────────────────────────────────────────────────────
    @Column(name = "historique_resa", columnDefinition = "TEXT")
    private String historiqueResa;

    // ── Champs Guichetier ──────────────────────────────────────────────────
    @Column(name = "poste", length = 100)
    private String poste;

    // ── Champs Chauffeur ───────────────────────────────────────────────────
    @Column(name = "numero_permis", length = 50)
    private String numeroPermis;

    @Column(name = "id_voyage_actuel")
    private UUID idVoyageActuel;

    @Column(name = "disponible")
    private Boolean disponible;

    @Column(name = "date_embauche")
    private LocalDateTime dateEmbauche;

    // ── Champs Administrateur ──────────────────────────────────────────────
    @Column(name = "niveau_acces")
    private Integer niveauAcces;

    // ── Champs ManagerGlobal ───────────────────────────────────────────────
    @Column(name = "id_agence_manager")
    private UUID idAgenceManager;

    // ── Audit ──────────────────────────────────────────────────────────────
    @CreationTimestamp
    @Column(name = "date_inscription", nullable = false, updatable = false)
    private LocalDateTime dateInscription;

    @Column(name = "derniere_connexion")
    private LocalDateTime derniereConnexion;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    // ── Relations ──────────────────────────────────────────────────────────
    @OneToMany(
        mappedBy   = "auteur",
        cascade    = CascadeType.ALL,
        orphanRemoval = true,
        fetch      = FetchType.LAZY
    )
    @Builder.Default
    private List<Avis> avisListe = new ArrayList<>();
}