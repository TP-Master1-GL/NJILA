package com.njila.njila_booking_service.domain.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "tickets_embarquement")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class TicketEmbarquement extends Ticket {

    // Numéro de la place dans le bus
    @Column(nullable = false)
    private String numeroPlace;

    // Si généré depuis un billet électronique
    private Long idTicketElectronique;

    // Guichetier qui a émis ce billet
    private Long idGuichetier;

    @Override
    public String genererNumeroTicket() {
        return getNumeroTicket();
    }

    @Override
    public boolean validerTicket() {
        return !getUtilise()
                && getStatut() != null
                && getStatut().name().equals("ACTIF");
    }
}