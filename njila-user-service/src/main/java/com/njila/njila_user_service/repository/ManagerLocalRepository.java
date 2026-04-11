package com.njila.njila_user_service.repository;

import com.njila.njila_user_service.entity.ManagerLocal;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ManagerLocalRepository extends JpaRepository<ManagerLocal, UUID> {
    
    List<ManagerLocal> findAllByAgenceId(UUID agenceId);
    List<ManagerLocal> findAllByFilialeId(UUID filialeId);
    boolean existsByFilialeId(UUID filialeId);
    
    // Requête optimisée - jointure directe
    @Query("SELECT ml FROM ManagerLocal ml WHERE ml.agenceId = :agenceId")
    List<ManagerLocal> findManagersLocauxByAgenceId(@Param("agenceId") UUID agenceId);
    
    @Query("SELECT ml FROM ManagerLocal ml WHERE ml.filialeId = :filialeId")
    List<ManagerLocal> findManagersLocauxByFilialeId(@Param("filialeId") UUID filialeId);
}