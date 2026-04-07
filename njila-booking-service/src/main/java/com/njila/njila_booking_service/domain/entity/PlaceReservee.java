package com.njila.njila_booking_service.domain.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "places_reservees")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class PlaceReservee {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_reservation", nullable = false)
    private Reservation reservation;

    // Référence externe — place dans le bus (fleet-service)
    @Column(nullable = false)
    private Long idPlace;

    @Column(nullable = false)
    private Double prixUnitaire;

    @Column(nullable = false)
    private String nomPassager;

    private String telephonePassager;

    @Column(nullable = false)
    private Boolean aBagage;

    // ─── Champs groupe ────────────────────────────────────────────────────────
    // true = celui qui a la CNI (responsable du groupe)
    @Column(nullable = false)
    @Builder.Default
    private Boolean estResponsable = false;

    // Renseigné uniquement pour le responsable (idVoyageur du user-service)
    private Long idVoyageur;

    @OneToOne(mappedBy = "placeReservee", cascade = CascadeType.ALL)
    private BagageDetails bagageDetails;
}