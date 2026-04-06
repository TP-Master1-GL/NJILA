package com.njila.njila_booking_service.repository;

import com.njila.njila_booking_service.domain.entity.Ticket;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface TicketRepository extends JpaRepository<Ticket, Long> {
    Optional<Ticket> findByNumeroTicket(String numeroTicket);
    boolean existsByNumeroTicket(String numeroTicket);
}