package com.njila.njila_user_service.repository;

import com.njila.njila_user_service.entity.Agence;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface AgenceRepository extends JpaRepository<Agence, UUID> {

    boolean existsByIdAgence(UUID idAgence);
}