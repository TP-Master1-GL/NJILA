package com.njila.njila_user_service.repository;

import com.njila.njila_user_service.entity.Chauffeur;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ChauffeurRepository extends JpaRepository<Chauffeur, UUID> {
    
    // Méthodes existantes
    List<Chauffeur> findAllByFilialeId(UUID filialeId);
    List<Chauffeur> findAllByAgenceId(UUID agenceId);
    List<Chauffeur> findAllByDisponibleTrue();
    
    @Query("SELECT c FROM Chauffeur c WHERE c.filialeId = :filialeId AND c.disponible = true")
    List<Chauffeur> findChauffeursDisponiblesByFiliale(@Param("filialeId") UUID filialeId);
    
    // Requêtes optimisées
    @Query("SELECT c FROM Chauffeur c WHERE c.agenceId = :agenceId")
    List<Chauffeur> findChauffeursByAgenceId(@Param("agenceId") UUID agenceId);
    
    @Query("SELECT c FROM Chauffeur c WHERE c.filialeId = :filialeId")
    List<Chauffeur> findChauffeursByFilialeId(@Param("filialeId") UUID filialeId);
    
    @Query("SELECT c FROM Chauffeur c WHERE c.agenceId = :agenceId AND c.filialeId = :filialeId")
    List<Chauffeur> findChauffeursByAgenceAndFiliale(@Param("agenceId") UUID agenceId, 
                                                      @Param("filialeId") UUID filialeId);
    
    @Query("SELECT c FROM Chauffeur c WHERE c.agenceId = :agenceId AND c.disponible = true")
    List<Chauffeur> findChauffeursDisponiblesByAgence(@Param("agenceId") UUID agenceId);
}