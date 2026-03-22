package com.njila.njila_booking_service.domain.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;

@Entity
@Table(name = "compteurs_fidelite",
        uniqueConstraints = @UniqueConstraint(
            columnNames = {"id_voyageur", "code_agence", "annee"}
        ))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class CompteurFidelite {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "id_voyageur", nullable = false)
    private Long idVoyageur;

    @Column(name = "code_agence", nullable = false)
    private String codeAgence;

    @Column(nullable = false)
    private Integer annee;

    @Column(nullable = false)
    private Integer nombreVoyages;

    // Nombre de voyages gratuits déjà utilisés cette année
    @Column(nullable = false)
    private Integer voyagesGratuitsUtilises;

    private LocalDate derniereReservation;

    @PrePersist
    public void prePersist() {
        if (this.nombreVoyages == null)         this.nombreVoyages = 0;
        if (this.voyagesGratuitsUtilises == null) this.voyagesGratuitsUtilises = 0;
        if (this.annee == null)                 this.annee = LocalDate.now().getYear();
    }
}