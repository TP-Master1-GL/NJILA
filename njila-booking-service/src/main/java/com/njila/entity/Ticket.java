package com.njila.entity;


import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
 
import java.time.LocalDateTime;
 
/**
 * Billet électronique généré après confirmation du paiement.
 * Table : tickets
 */
@Entity
@Table(name = "tickets")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Ticket {
 
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
 
    @Column(name = "numero_ticket", unique = true, nullable = false, length = 50)
    private String numeroTicket;
 
    @Column(name = "qr_code", nullable = false, length = 500)
    private String qrCode;
 
    @Column(name = "origine", nullable = false, length = 100)
    private String origine;
 
    @Column(name = "destination", nullable = false, length = 100)
    private String destination;
 
    @Column(name = "date_depart", nullable = false)
    private LocalDateTime dateDepart;
 
    @Column(name = "nom_voyageur", nullable = false, length = 150)
    private String nomVoyageur;
 
    @Column(name = "nom_agence", nullable = false, length = 150)
    private String nomAgence;
 
    @Column(name = "montant", nullable = false)
    private double montant;
 
    @Column(name = "url_pdf", length = 500)
    private String urlPdf;
 
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reservation_id", nullable = false)
    private Reservation reservation;
 
    @CreationTimestamp
    @Column(name = "date_emission", updatable = false)
    private LocalDateTime dateEmission;
}
 