package com.njila.entity;


import com.njila.enums.ClasseBus;
import com.njila.enums.StatutReservation;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Entité principale de la réservation NJILA.
 * Table : reservations
 */
@Entity
@Table(name = "reservations")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Reservation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "voyage_id", nullable = false)
    private Long voyageId;

    @Column(name = "voyageur_id", nullable = false)
    private Long voyageurId;

    @Column(name = "agence_id", nullable = false)
    private Long agenceId;

    @Column(name = "nombre_places", nullable = false)
    private int nombrePlaces;

    @Column(name = "prix_total", nullable = false)
    private double prixTotal;

    @Enumerated(EnumType.STRING)
    @Column(name = "statut", nullable = false, length = 20)
    private StatutReservation statut;

    @Enumerated(EnumType.STRING)
    @Column(name = "classe_bus", nullable = false, length = 10)
    private ClasseBus classeBus;

    @Column(name = "code_reservation", unique = true, nullable = false, length = 20)
    private String codeReservation;

    @Column(name = "code_promo", length = 50)
    private String codePromo;

    @Column(name = "session_id", length = 100)
    private String sessionId;

    @Column(name = "date_expiration")
    private LocalDateTime dateExpiration;

    @CreationTimestamp
    @Column(name = "date_creation", updatable = false)
    private LocalDateTime dateCreation;

    @UpdateTimestamp
    @Column(name = "date_modification")
    private LocalDateTime dateModification;

    // Relations
    @OneToMany(mappedBy = "reservation", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @Builder.Default
    private List<PlaceReservee> placesReservees = new ArrayList<>();

    @OneToOne(mappedBy = "reservation", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private Ticket ticket;

    // Méthode utilitaire pour ajouter une place
    public void ajouterPlace(PlaceReservee place) {
        placesReservees.add(place);
        place.setReservation(this);
    }

    // Méthode utilitaire pour assigner le ticket
    public void setTicket(Ticket ticket) {
        this.ticket = ticket;
        if (ticket != null) {
            ticket.setReservation(this);
        }
    }
}
