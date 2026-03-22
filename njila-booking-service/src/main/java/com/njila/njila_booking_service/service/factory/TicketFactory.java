package com.njila.njila_booking_service.service.factory;

import com.njila.njila_booking_service.domain.entity.Reservation;
import com.njila.njila_booking_service.domain.entity.Ticket;

public abstract class TicketFactory {

    public abstract Ticket creerTicket(Reservation reservation,String numeroTicket,String nomVoyageur,
                                    String telephoneVoyageur,
                                    String origine,
                                    String destination,
                                    String dateDepart,
                                    String immatriculationBus);
}