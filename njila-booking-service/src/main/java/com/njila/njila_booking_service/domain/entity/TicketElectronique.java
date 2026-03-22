package com.njila.njila_booking_service.domain.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "tickets_electroniques")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class TicketElectronique extends Ticket {

    // Chemin du PDF généré
    private String cheminPdf;

    // Indique si le billet a été converti en billet d'embarquement
    @Column(nullable = false)
    private Boolean converti;

    private Long idTicketEmbarquement;

    @PrePersist
    public void prePersist() {
        super.prePersist();
        this.converti = false;
    }

    @Override
    public String genererNumeroTicket() {
        return getNumeroTicket();
    }

    @Override
    public boolean validerTicket() {
        return !getUtilise() && getStatut() != null
                && getStatut().name().equals("ACTIF")
                && !converti;
    }
}