package com.njila.njila_user_service.service.impl.agent;

import com.njila.njila_user_service.dto.response.UserProfileResponse;
import com.njila.njila_user_service.entity.Chauffeur;
import com.njila.njila_user_service.entity.Guichetier;
import com.njila.njila_user_service.entity.UserProfile;
import com.njila.njila_user_service.exception.ForbiddenException;
import com.njila.njila_user_service.exception.ProfileNotFoundException;
import com.njila.njila_user_service.middleware.JwtClaims;
import com.njila.njila_user_service.repository.ChauffeurRepository;
import com.njila.njila_user_service.repository.GuichetierRepository;
import com.njila.njila_user_service.repository.UserRepository;
import com.njila.njila_user_service.service.EmployeFilialeService;
import com.njila.njila_user_service.service.RoleManager;
import com.njila.njila_user_service.service.impl.StaffQueryService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmployeFilialeServiceImpl implements EmployeFilialeService {

    private final UserRepository userRepository;
    private final GuichetierRepository guichetierRepository;
    private final ChauffeurRepository chauffeurRepository;
    private final RoleManager roleManager;
    private final StaffQueryService staffQueryService;

    @Override
    @Transactional(readOnly = true)
    @Cacheable(value = "profiles", key = "#employeId.toString()", unless = "#result == null")
    public UserProfileResponse getEmployeProfile(UUID employeId, JwtClaims caller) {
        UserProfile employe = userRepository.findById(employeId)
            .orElseThrow(() -> new ProfileNotFoundException(employeId.toString()));
        
        // Vérifier les droits d'accès selon le rôle du caller
        if (caller.getRole() == com.njila.njila_user_service.enums.Role.MANAGER_LOCAL) {
            UUID filialeId = null;
            if (employe instanceof com.njila.njila_user_service.entity.AgentFiliale) {
                filialeId = ((com.njila.njila_user_service.entity.AgentFiliale) employe).getFilialeId();
            }
            if (filialeId == null || !filialeId.equals(caller.getFilialeId())) {
                throw new ForbiddenException("Vous ne pouvez consulter que les employés de votre filiale.");
            }
        } else if (caller.getRole() == com.njila.njila_user_service.enums.Role.MANAGER_GLOBAL) {
            UUID agenceId = null;
            if (employe instanceof com.njila.njila_user_service.entity.AgentFiliale) {
                agenceId = ((com.njila.njila_user_service.entity.AgentFiliale) employe).getAgenceId();
            }
            if (agenceId == null || !agenceId.equals(caller.getAgenceId())) {
                throw new ForbiddenException("Vous ne pouvez consulter que les employés de votre agence.");
            }
        } else if (caller.getRole() != com.njila.njila_user_service.enums.Role.ADMINISTRATEUR) {
            throw new ForbiddenException("Vous n'êtes pas autorisé à consulter ce profil.");
        }
        
        return toResponse(employe);
    }

    @Override
    @Transactional(readOnly = true)
    public List<UserProfileResponse> getAllEmployesByFiliale(UUID filialeId, JwtClaims caller) {
        roleManager.assertCanViewEmployesByFiliale(caller, filialeId);
        
        List<UserProfile> employes = staffQueryService.findAllEmployesByFilialeId(filialeId);
        
        return employes.stream()
            .map(this::toResponse)
            .collect(Collectors.toList());
    }

    @Override
    @Transactional
    @CacheEvict(value = "profiles", key = "#chauffeurId.toString()")
    public void updateDisponibilite(UUID chauffeurId, Boolean disponible, JwtClaims caller) {
        Chauffeur chauffeur = chauffeurRepository.findById(chauffeurId)
            .orElseThrow(() -> new ProfileNotFoundException("Chauffeur non trouvé: " + chauffeurId));
        
        // Vérifier les droits
        if (caller.getRole() == com.njila.njila_user_service.enums.Role.MANAGER_LOCAL) {
            if (!chauffeur.getFilialeId().equals(caller.getFilialeId())) {
                throw new ForbiddenException("Vous ne pouvez modifier que les chauffeurs de votre filiale.");
            }
        } else if (caller.getRole() == com.njila.njila_user_service.enums.Role.MANAGER_GLOBAL) {
            if (!chauffeur.getAgenceId().equals(caller.getAgenceId())) {
                throw new ForbiddenException("Vous ne pouvez modifier que les chauffeurs de votre agence.");
            }
        } else if (caller.getRole() != com.njila.njila_user_service.enums.Role.ADMINISTRATEUR 
                   && !caller.getUserId().equals(chauffeurId)) {
            throw new ForbiddenException("Vous n'êtes pas autorisé à modifier cette disponibilité.");
        }
        
        chauffeur.setDisponible(disponible);
        chauffeurRepository.save(chauffeur);
        
        log.info("[EMPLOYE] Disponibilité mise à jour | chauffeurId={} disponible={} par caller={}", 
                 chauffeurId, disponible, caller.getUserId());
    }
    
    private UserProfileResponse toResponse(UserProfile p) {
        com.njila.njila_user_service.entity.AgentFiliale agent =
            (p instanceof com.njila.njila_user_service.entity.AgentFiliale)
                ? (com.njila.njila_user_service.entity.AgentFiliale) p : null;

        return UserProfileResponse.builder()
            .idUser(p.getIdUser())
            .name(p.getName())
            .surname(p.getSurname())
            .email(p.getEmail())
            .phone(p.getPhone())
            .adresse(p.getAdresse())
            .photoProfil(p.getPhotoProfil())
            .role(p.getRole())
            .userType(p.getClass().getSimpleName())
            .isActive(p.isActive())
            .dateInscription(p.getDateInscription())
            .derniereConnexion(p.getDerniereConnexion())
            .agenceId(agent != null ? agent.getAgenceId() : null)
            .filialeId(agent != null ? agent.getFilialeId() : null)
            .build();
    }
}