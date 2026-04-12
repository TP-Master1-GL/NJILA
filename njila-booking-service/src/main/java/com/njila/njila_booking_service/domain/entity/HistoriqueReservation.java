package com.njila.njila_booking_service.domain.entity;

import com.njila.njila_booking_service.domain.enums.TypeAction;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "historique_reservations")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class HistoriqueReservation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_reservation", nullable = false)
    private Reservation reservation;

    private Long idUtilisateur;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TypeAction action;

    @Column(nullable = false)
    private LocalDateTime dateAction;

    private String details;

    @PrePersist
    public void prePersist() {
        this.dateAction = LocalDateTime.now();
    }

    public static HistoriqueReservation creer(Reservation reservation,
                                                TypeAction action,
                                                Long idUtilisateur,
                                                String details) {
        return HistoriqueReservation.builder()
                .reservation(reservation)
                .action(action)
                .idUtilisateur(idUtilisateur)
                .details(details)
                .build();
    }
}