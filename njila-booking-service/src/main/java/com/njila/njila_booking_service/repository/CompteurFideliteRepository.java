package com.njila.njila_booking_service.repository;

import com.njila.njila_booking_service.domain.entity.CompteurFidelite;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface CompteurFideliteRepository extends JpaRepository<CompteurFidelite, Long> {

    Optional<CompteurFidelite> findByIdVoyageurAndCodeAgenceAndAnnee(
            Long idVoyageur, String codeAgence, Integer annee);
}