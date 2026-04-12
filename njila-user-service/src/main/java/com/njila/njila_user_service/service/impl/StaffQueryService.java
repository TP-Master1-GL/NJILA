package com.njila.njila_user_service.service.impl;

import com.njila.njila_user_service.entity.*;
import com.njila.njila_user_service.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;


@Service
@RequiredArgsConstructor
@Slf4j
public class StaffQueryService {

    private final ManagerLocalRepository managerLocalRepository;
    private final GuichetierRepository guichetierRepository;
    private final ChauffeurRepository chauffeurRepository;

    /**
     * Récupère tous les staff d'une agence (ManagerLocal + Guichetiers + Chauffeurs)
     */
    @Transactional(readOnly = true)
    public List<UserProfile> findAllStaffByAgenceId(UUID agenceId) {
        List<UserProfile> staff = new ArrayList<>();
        staff.addAll(managerLocalRepository.findManagersLocauxByAgenceId(agenceId));
        staff.addAll(guichetierRepository.findGuichetiersByAgenceId(agenceId));
        staff.addAll(chauffeurRepository.findChauffeursByAgenceId(agenceId));
        return staff;
    }

    /**
     * Récupère tous les ManagerLocal d'une agence
     */
    @Transactional(readOnly = true)
    public List<ManagerLocal> findAllManagerLocauxByAgenceId(UUID agenceId) {
        return managerLocalRepository.findManagersLocauxByAgenceId(agenceId);
    }

    /**
     * Récupère tous les employés d'une agence (Guichetiers + Chauffeurs)
     */
    @Transactional(readOnly = true)
    public List<UserProfile> findAllEmployesByAgenceId(UUID agenceId) {
        List<UserProfile> employes = new ArrayList<>();
        employes.addAll(guichetierRepository.findGuichetiersByAgenceId(agenceId));
        employes.addAll(chauffeurRepository.findChauffeursByAgenceId(agenceId));
        return employes;
    }

    /**
     * Récupère tous les employés d'une agence et filiale spécifiques
     */
    @Transactional(readOnly = true)
    public List<UserProfile> findAllEmployesByAgenceAndFiliale(UUID agenceId, UUID filialeId) {
        List<UserProfile> employes = new ArrayList<>();
        employes.addAll(guichetierRepository.findGuichetiersByAgenceAndFiliale(agenceId, filialeId));
        employes.addAll(chauffeurRepository.findChauffeursByAgenceAndFiliale(agenceId, filialeId));
        return employes;
    }

    /**
     * Récupère tous les employés d'une filiale (Guichetiers + Chauffeurs)
     */
    @Transactional(readOnly = true)
    public List<UserProfile> findAllEmployesByFilialeId(UUID filialeId) {
        List<UserProfile> employes = new ArrayList<>();
        employes.addAll(guichetierRepository.findGuichetiersByFilialeId(filialeId));
        employes.addAll(chauffeurRepository.findChauffeursByFilialeId(filialeId));
        return employes;
    }

    /**
     * Récupère tous les guichetiers d'une filiale
     */
    @Transactional(readOnly = true)
    public List<Guichetier> findAllGuichetiersByFilialeId(UUID filialeId) {
        return guichetierRepository.findGuichetiersByFilialeId(filialeId);
    }

    /**
     * Récupère tous les chauffeurs d'une filiale
     */
    @Transactional(readOnly = true)
    public List<Chauffeur> findAllChauffeursByFilialeId(UUID filialeId) {
        return chauffeurRepository.findChauffeursByFilialeId(filialeId);
    }

    /**
     * Récupère tous les chauffeurs disponibles d'une filiale
     */
    @Transactional(readOnly = true)
    public List<Chauffeur> findChauffeursDisponiblesByFiliale(UUID filialeId) {
        return chauffeurRepository.findChauffeursDisponiblesByFiliale(filialeId);
    }
}