package com.njila.njila_user_service.repository;

import com.njila.njila_user_service.entity.Voyageur;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface VoyageurRepository extends JpaRepository<Voyageur, UUID> {
}