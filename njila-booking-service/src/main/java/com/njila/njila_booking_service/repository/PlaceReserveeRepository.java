package com.njila.njila_booking_service.repository;

import com.njila.njila_booking_service.domain.entity.PlaceReservee;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface PlaceReserveeRepository extends JpaRepository<PlaceReservee, Long> {
    List<PlaceReservee> findByReservationId(Long reservationId);
}