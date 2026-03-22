package com.njila.njila_booking_service.domain.entity;

import com.njila.njila_booking_service.domain.enums.OperateurPaiement;
import com.njila.njila_booking_service.domain.enums.StatutPaiement;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "paiements")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Paiement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_reservation", nullable = false)
    private Reservation reservation;

    @Column(nullable = false)
    private Double montant;

    @Column(nullable = false)
    private LocalDateTime datePaiement;

    @Enumerated(EnumType.STRING)
    private OperateurPaiement operateur;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private StatutPaiement statut;

    private String numeroPaiement;
    private String referenceTransaction;
    private String detailsTransaction;

    @PrePersist
    public void prePersist() {
        this.datePaiement = LocalDateTime.now();
        if (this.statut == null) {
            this.statut = StatutPaiement.EN_COURS;
        }
    }
}