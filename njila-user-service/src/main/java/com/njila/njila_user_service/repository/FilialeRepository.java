package com.njila.njila_user_service.repository;

import com.njila.njila_user_service.entity.Filiale;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface FilialeRepository extends JpaRepository<Filiale, UUID> {

    boolean existsByIdFiliale(UUID idFiliale);

    List<Filiale> findAllByAgenceId(UUID agenceId);
}