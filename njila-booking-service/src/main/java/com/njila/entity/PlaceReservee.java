package com.njila.entity;


import jakarta.persistence.*;
import lombok.*;

/**
 * Siège individuellement réservé dans une Reservation.
 * Table : places_reservees
 */
@Entity
@Table(name = "places_reservees")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PlaceReservee {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "numero_place", nullable = false)
    private int numeroPlace;

    @Column(name = "nom_passager", nullable = false, length = 100)
    private String nomPassager;

    @Column(name = "cni_passager", length = 50)
    private String cniPassager;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reservation_id", nullable = false)
    private Reservation reservation;
}
