package com.njila.njila_booking_service.domain.entity;

import com.njila.njila_booking_service.domain.enums.CanalReservation;
import com.njila.njila_booking_service.domain.enums.StatutReservation;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "reservations")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Reservation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private LocalDateTime dateReservation;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private StatutReservation statut;

    @Column(nullable = false)
    private Integer nombrePlaces;

    @Column(nullable = false)
    private Double montantTotal;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private CanalReservation canal;

    // ─── Références externes (IDs des autres services) ────────────────────────
    @Column(nullable = false)
    private Long idVoyage;

    @Column(nullable = false)
    private Long idVoyageur;

    // Null si réservation en ligne
    private Long idGuichetier;

    // Code agence mère ex: GEN, BNM — pour génération numéro billet
    @Column(nullable = false)
    private String codeAgence;

    // Code filiale ex: BYDE, DKLA — pour génération numéro billet
    @Column(nullable = false)
    private String codeFiliale;

    // ─── Relations ────────────────────────────────────────────────────────────
    @OneToMany(mappedBy = "reservation", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<PlaceReservee> placesReservees = new ArrayList<>();

    @OneToOne(mappedBy = "reservation", cascade = CascadeType.ALL)
    private Paiement paiement;

    @OneToMany(mappedBy = "reservation", cascade = CascadeType.ALL)
    @Builder.Default
    private List<HistoriqueReservation> historique = new ArrayList<>();

    @OneToMany(mappedBy = "reservation", cascade = CascadeType.ALL)
    @Builder.Default
    private List<Ticket> tickets = new ArrayList<>();

    @PrePersist
    public void prePersist() {
        this.dateReservation = LocalDateTime.now();
        if (this.statut == null) {
            this.statut = StatutReservation.EN_ATTENTE;
        }
    }
}