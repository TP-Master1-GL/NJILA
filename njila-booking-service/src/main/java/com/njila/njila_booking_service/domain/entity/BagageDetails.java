package com.njila.njila_booking_service.domain.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "bagage_details")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class BagageDetails {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_place_reservee", nullable = false)
    private PlaceReservee placeReservee;

    @Column(nullable = false)
    private String natureBagage;

    @Column(nullable = false)
    private Integer quantite;

    @Column(nullable = false)
    private Double poidsKg;

    @Column(nullable = false)
    private Double supplementPrix;
}