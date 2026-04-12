package com.njila.njila_user_service.repository;

import com.njila.njila_user_service.entity.Guichetier;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface GuichetierRepository extends JpaRepository<Guichetier, UUID> {
    
    List<Guichetier> findAllByFilialeId(UUID filialeId);
    List<Guichetier> findAllByAgenceId(UUID agenceId);
    
    @Query("SELECT g FROM Guichetier g WHERE g.agenceId = :agenceId")
    List<Guichetier> findGuichetiersByAgenceId(@Param("agenceId") UUID agenceId);
    
    @Query("SELECT g FROM Guichetier g WHERE g.filialeId = :filialeId")
    List<Guichetier> findGuichetiersByFilialeId(@Param("filialeId") UUID filialeId);
    
    @Query("SELECT g FROM Guichetier g WHERE g.agenceId = :agenceId AND g.filialeId = :filialeId")
    List<Guichetier> findGuichetiersByAgenceAndFiliale(@Param("agenceId") UUID agenceId, 
                                                        @Param("filialeId") UUID filialeId);
}