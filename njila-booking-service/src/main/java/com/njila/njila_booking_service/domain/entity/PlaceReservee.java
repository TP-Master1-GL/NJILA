package com.njila.njila_booking_service.domain.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.ColumnDefault;

@Entity
@Table(
    name = "places_reservees",
    indexes = {
        @Index(name = "idx_place_voyage_siege", columnList = "id_reservation")
    }
)
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class PlaceReservee {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_reservation", nullable = false)
    private Reservation reservation;

    @Column(name = "numero_siege", nullable = false)
    @ColumnDefault("0")
    private Integer numeroSiege;

    /**
     * Référence externe OPTIONNELLE vers l'entité Place dans fleet-service.
     * nullable = true car le booking-service gère les sièges uniquement
     * via numeroSiege. idPlace n'est jamais transmis dans le flux WEB.
     */
    @Column(name = "id_place", nullable = true)
    private Long idPlace;

    @Column(nullable = false)
    private Double prixUnitaire;

    @Column(nullable = false)
    private String nomPassager;

    private String telephonePassager;

    @Column(nullable = false)
    private Boolean aBagage;

    @Column(nullable = false)
    @Builder.Default
    private Boolean estResponsable = false;

    private String idVoyageur;

    @OneToOne(mappedBy = "placeReservee", cascade = CascadeType.ALL)
    private BagageDetails bagageDetails;
}
