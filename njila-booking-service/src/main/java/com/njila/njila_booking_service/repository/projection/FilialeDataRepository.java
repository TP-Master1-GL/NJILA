package com.njila.njila_booking_service.repository.projection;

import com.njila.njila_booking_service.domain.entity.projection.FilialeData;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface FilialeDataRepository extends JpaRepository<FilialeData, String> {
}
