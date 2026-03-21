package com.njila.entity;

 
import com.njila.enums.StatutReservation;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
 
import java.time.LocalDateTime;
 
/**
 * Journal d'audit de chaque changement de statut d'une réservation.
 * Table : historique_reservation
 * Pas de FK directe pour découpler l'audit de l'entité principale.
 */
@Entity
@Table(name = "historique_reservation")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class HistoriqueReservation {
 
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
 
    @Column(name = "reservation_id", nullable = false)
    private Long reservationId;
 
    @Enumerated(EnumType.STRING)
    @Column(name = "ancien_statut", length = 20)
    private StatutReservation ancienStatut; // null à la création
 
    @Enumerated(EnumType.STRING)
    @Column(name = "nouveau_statut", nullable = false, length = 20)
    private StatutReservation nouveauStatut;
 
    @Column(name = "motif", length = 500)
    private String motif;
 
    /**
     * Acteur de l'action : "VOYAGEUR", "SYSTEM", "GUICHETIER"
     */
    @Column(name = "declenche_par", length = 20)
    private String declenchePar;
 
    @CreationTimestamp
    @Column(name = "date_action", updatable = false)
    private LocalDateTime dateAction;
}
