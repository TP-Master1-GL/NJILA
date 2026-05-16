package com.njila.njila_user_service.repository;

import com.njila.njila_user_service.entity.Avis;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface AvisRepository extends JpaRepository<Avis, UUID> {

    /** Un seul avis par utilisateur par agence */
    Optional<Avis> findByAuteurIdUserAndAgenceId(UUID auteurId, UUID agenceId);

    /** Avis visibles d'une agence (paginé — endpoint public) */
    Page<Avis> findAllByAgenceIdAndVisibleTrue(UUID agenceId, Pageable pageable);

    /** Tous les avis émis par un utilisateur */
    List<Avis> findAllByAuteurIdUser(UUID auteurId);

    /** Note moyenne d'une agence */
    @Query("SELECT AVG(a.note) FROM Avis a WHERE a.agenceId = :agenceId AND a.visible = true")
    Double getNoteMoyenneByAgenceId(@Param("agenceId") UUID agenceId);

    /** Nombre d'avis d'une agence */
    long countByAgenceIdAndVisibleTrue(UUID agenceId);

    /** Avis signalés pour modération (admin) */
    List<Avis> findAllBySignaleTrue();
}