package com.njila.njila_booking_service.service.factory;

import com.njila.njila_booking_service.domain.entity.Reservation;
import com.njila.njila_booking_service.domain.entity.Ticket;
import com.njila.njila_booking_service.domain.entity.TicketElectronique;
import com.njila.njila_booking_service.domain.enums.StatutTicket;
import org.springframework.stereotype.Component;
import java.time.LocalDate;

@Component
public class TicketElectroniqueFactory extends TicketFactory {

    @Override
    public Ticket creerTicket(Reservation reservation,
                                String numeroTicket,
                                String nomVoyageur,
                                String telephoneVoyageur,
                                String origine,
                                String destination,
                                String dateDepart,
                                String immatriculationBus) {

        TicketElectronique ticket = new TicketElectronique();
        ticket.setNumeroTicket(numeroTicket);
        ticket.setNomVoyageur(nomVoyageur);
        ticket.setTelephoneVoyageur(telephoneVoyageur);
        ticket.setOrigine(origine);
        ticket.setDestination(destination);
        ticket.setDateDepart(LocalDate.parse(dateDepart));
        ticket.setImmatriculationBus(immatriculationBus);
        ticket.setStatut(StatutTicket.ACTIF);
        ticket.setReservation(reservation);
        ticket.setIdReservation(reservation.getId());
        ticket.setConverti(false);
        return ticket;
    }
}