package com.njila.njila_user_service.service;

import com.njila.njila_user_service.dto.response.AgenceResponse;
import com.njila.njila_user_service.dto.response.FilialeResponse;
import com.njila.njila_user_service.entity.Agence;
import com.njila.njila_user_service.entity.Filiale;
import com.njila.njila_user_service.exception.AgenceNotFoundException;
import com.njila.njila_user_service.repository.AgenceRepository;
import com.njila.njila_user_service.repository.FilialeRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AgenceFilialeService {

    private final AgenceRepository agenceRepository;
    private final FilialeRepository filialeRepository;

    /**
     * Récupère la liste de toutes les agences
     */
    @Transactional(readOnly = true)
    @Cacheable(value = "agences", key = "'all'")
    public List<AgenceResponse> getAllAgences() {
        log.debug("[SERVICE] Récupération de toutes les agences");
        return agenceRepository.findAll().stream()
            .map(this::toAgenceResponse)
            .collect(Collectors.toList());
    }

    /**
     * Récupère la liste des agences actives uniquement
     */
    @Transactional(readOnly = true)
    @Cacheable(value = "agences", key = "'active'")
    public List<AgenceResponse> getActiveAgences() {
        log.debug("[SERVICE] Récupération des agences actives");
        return agenceRepository.findAll().stream()
            .filter(Agence::isActive)
            .map(this::toAgenceResponse)
            .collect(Collectors.toList());
    }

    /**
     * Récupère une agence par son ID
     */
    @Transactional(readOnly = true)
    @Cacheable(value = "agences", key = "#agenceId")
    public AgenceResponse getAgenceById(UUID agenceId) {
        log.debug("[SERVICE] Récupération de l'agence | id={}", agenceId);
        Agence agence = agenceRepository.findById(agenceId)
            .orElseThrow(() -> new AgenceNotFoundException(agenceId.toString()));
        return toAgenceResponse(agence);
    }

    /**
     * Récupère la liste de toutes les filiales
     */
    @Transactional(readOnly = true)
    @Cacheable(value = "filiales", key = "'all'")
    public List<FilialeResponse> getAllFiliales() {
        log.debug("[SERVICE] Récupération de toutes les filiales");
        return filialeRepository.findAll().stream()
            .map(this::toFilialeResponse)
            .collect(Collectors.toList());
    }

    /**
     * Récupère la liste des filiales actives uniquement
     */
    @Transactional(readOnly = true)
    @Cacheable(value = "filiales", key = "'active'")
    public List<FilialeResponse> getActiveFiliales() {
        log.debug("[SERVICE] Récupération des filiales actives");
        return filialeRepository.findAll().stream()
            .filter(Filiale::isActive)
            .map(this::toFilialeResponse)
            .collect(Collectors.toList());
    }

    /**
     * Récupère la liste des filiales par agence
     */
    @Transactional(readOnly = true)
    @Cacheable(value = "filiales", key = "'agence_' + #agenceId")
    public List<FilialeResponse> getFilialesByAgence(UUID agenceId) {
        log.debug("[SERVICE] Récupération des filiales | agenceId={}", agenceId);
        
        // Vérifier que l'agence existe
        if (!agenceRepository.existsById(agenceId)) {
            throw new AgenceNotFoundException(agenceId.toString());
        }
        
        return filialeRepository.findAllByAgenceId(agenceId).stream()
            .map(this::toFilialeResponse)
            .collect(Collectors.toList());
    }

    /**
     * Récupère une filiale par son ID
     */
    @Transactional(readOnly = true)
    @Cacheable(value = "filiales", key = "#filialeId")
    public FilialeResponse getFilialeById(UUID filialeId) {
        log.debug("[SERVICE] Récupération de la filiale | id={}", filialeId);
        Filiale filiale = filialeRepository.findById(filialeId)
            .orElseThrow(() -> new RuntimeException("Filiale non trouvée : " + filialeId));
        return toFilialeResponse(filiale);
    }

    /**
     * Vérifie si une agence existe
     */
    @Transactional(readOnly = true)
    public boolean agenceExists(UUID agenceId) {
        return agenceRepository.existsById(agenceId);
    }

    /**
     * Vérifie si une filiale existe
     */
    @Transactional(readOnly = true)
    public boolean filialeExists(UUID filialeId) {
        return filialeRepository.existsById(filialeId);
    }

    // ==================== MAPPERS ====================

    private AgenceResponse toAgenceResponse(Agence agence) {
        return AgenceResponse.builder()
            .idAgence(agence.getIdAgence())
            .nom(agence.getNom())
            .description(agence.getDescription())
            .isActive(agence.isActive())
            .createdAt(agence.getCreatedAt())
            .build();
    }

    private FilialeResponse toFilialeResponse(Filiale filiale) {
        // Récupérer le nom de l'agence (gestion séparée pour éviter le problème de lambda)
        String agenceNom = getAgenceNom(filiale.getAgenceId());
        
        return FilialeResponse.builder()
            .idFiliale(filiale.getIdFiliale())
            .nom(filiale.getNom())
            .adresse(filiale.getAdresse())
            .ville(filiale.getVille())
            .agenceId(filiale.getAgenceId())
            .agenceNom(agenceNom)
            .isActive(filiale.isActive())
            .createdAt(filiale.getCreatedAt())
            .build();
    }
    
    /**
     * Méthode utilitaire pour récupérer le nom d'une agence
     * (extrait de la lambda pour résoudre l'erreur de compilation)
     */
    private String getAgenceNom(UUID agenceId) {
        if (agenceId == null) {
            return null;
        }
        try {
            return agenceRepository.findById(agenceId)
                .map(Agence::getNom)
                .orElse(null);
        } catch (Exception e) {
            log.warn("Impossible de récupérer le nom de l'agence pour id={}", agenceId);
            return null;
        }
    }
}