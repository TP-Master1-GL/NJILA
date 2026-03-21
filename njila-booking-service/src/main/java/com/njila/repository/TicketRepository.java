package com.njila.repository;

import com.njila.entity.Ticket;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface TicketRepository extends JpaRepository<Ticket, Long> {

    Optional<Ticket> findByNumeroTicket(String numeroTicket);

    Optional<Ticket> findByReservationId(Long reservationId);
}