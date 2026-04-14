package com.njila.njila_user_service.repository;

import com.njila.njila_user_service.entity.ManagerGlobal;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ManagerGlobalRepository extends JpaRepository<ManagerGlobal, UUID> {
    
    List<ManagerGlobal> findAllByAgenceId(UUID agenceId);
    boolean existsByAgenceId(UUID agenceId);
    
    @Query("SELECT mg FROM ManagerGlobal mg WHERE mg.agenceId = :agenceId")
    List<ManagerGlobal> findManagersGlobalByAgenceId(@Param("agenceId") UUID agenceId);
}