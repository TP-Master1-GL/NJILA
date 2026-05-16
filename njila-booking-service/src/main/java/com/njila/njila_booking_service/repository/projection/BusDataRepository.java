package com.njila.njila_booking_service.repository.projection;

import com.njila.njila_booking_service.domain.entity.projection.BusData;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface BusDataRepository extends JpaRepository<BusData, String> {

    /** Recherche par immatriculation — clé de jointure avec VoyageData */
    Optional<BusData> findByImmatriculation(String immatriculation);
}
