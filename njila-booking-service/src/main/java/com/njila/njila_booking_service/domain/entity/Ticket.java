package com.njila.njila_booking_service.domain.entity;

import com.njila.njila_booking_service.domain.enums.StatutTicket;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "tickets")
@Inheritance(strategy = InheritanceType.JOINED)
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public abstract class Ticket {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Format : GEN-WEB-20260321-BYDE-000142
    @Column(nullable = false, unique = true)
    private String numeroTicket;

    @Column(nullable = false)
    private LocalDateTime dateEmission;

    // ─── Données voyageur (récupérées depuis user-service) ────────────────────
    @Column(nullable = false)
    private String nomVoyageur;

    @Column(nullable = false)
    private String telephoneVoyageur;

    // ─── Données voyage (récupérées depuis fleet-service) ─────────────────────
    @Column(nullable = false)
    private String origine;

    @Column(nullable = false)
    private String destination;

    @Column(nullable = false)
    private LocalDate dateDepart;

    @Column(nullable = false)
    private String immatriculationBus;

    // ─── Statut ───────────────────────────────────────────────────────────────
    @Column(nullable = false)
    private Boolean utilise;

    private LocalDateTime dateUtilisation;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private StatutTicket statut;

    // ─── Relation réservation ─────────────────────────────────────────────────
    // CORRECTION : supprimer idReservation comme champ séparé
    // et utiliser insertable=false, updatable=false sur la FK
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_reservation", nullable = false)
    private Reservation reservation;

    // Colonne en lecture seule — pointe sur la même colonne que la FK
    @Column(name = "id_reservation", insertable = false, updatable = false)
    private Long idReservation;

    @PrePersist
    public void prePersist() {
        this.dateEmission = LocalDateTime.now();
        this.utilise      = false;
        if (this.statut == null) {
            this.statut = StatutTicket.ACTIF;
        }
    }

    public abstract String genererNumeroTicket();
    public abstract boolean validerTicket();

    public void marquerUtilise() {
        this.utilise         = true;
        this.dateUtilisation = LocalDateTime.now();
        this.statut          = StatutTicket.EMBARQUEE;
    }
}