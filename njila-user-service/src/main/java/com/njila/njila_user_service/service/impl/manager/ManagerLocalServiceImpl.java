package com.njila.njila_user_service.service.impl.manager;

import com.njila.njila_user_service.dto.request.CreateChauffeurRequest;
import com.njila.njila_user_service.dto.request.CreateGuichetierRequest;
import com.njila.njila_user_service.dto.response.UserProfileResponse;
import com.njila.njila_user_service.entity.Chauffeur;
import com.njila.njila_user_service.entity.Filiale;
import com.njila.njila_user_service.entity.Guichetier;
import com.njila.njila_user_service.entity.UserProfile;
import com.njila.njila_user_service.enums.Role;
import com.njila.njila_user_service.exception.EmailAlreadyExistsException;
import com.njila.njila_user_service.exception.FilialeNotFoundException;
import com.njila.njila_user_service.exception.ForbiddenException;
import com.njila.njila_user_service.exception.ProfileNotFoundException;
import com.njila.njila_user_service.middleware.JwtClaims;
import com.njila.njila_user_service.repository.ChauffeurRepository;
import com.njila.njila_user_service.repository.FilialeRepository;
import com.njila.njila_user_service.repository.GuichetierRepository;
import com.njila.njila_user_service.repository.UserRepository;
import com.njila.njila_user_service.service.ManagerLocalService;
import com.njila.njila_user_service.service.RoleManager;
import com.njila.njila_user_service.events.publisher.EventPublisher;
import com.njila.njila_user_service.service.impl.StaffQueryService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class ManagerLocalServiceImpl implements ManagerLocalService {

    private final UserRepository userRepository;
    private final GuichetierRepository guichetierRepository;
    private final ChauffeurRepository chauffeurRepository;
    private final FilialeRepository filialeRepository;
    private final RoleManager roleManager;
    private final StaffQueryService staffQueryService;
    private final EventPublisher eventPublisher;
    
    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ISO_LOCAL_DATE_TIME;

    @Override
    @Transactional(readOnly = true)
    public List<UserProfileResponse> listEmployesByFiliale(UUID filialeId, JwtClaims caller) {
        roleManager.assertCanViewEmployesByFiliale(caller, filialeId);
        
        List<UserProfile> employes = staffQueryService.findAllEmployesByFilialeId(filialeId);
        return employes.stream()
            .map(this::toResponse)
            .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<UserProfileResponse> listGuichetiersByFiliale(UUID filialeId, JwtClaims caller) {
        roleManager.assertCanViewEmployesByFiliale(caller, filialeId);
        
        List<Guichetier> guichetiers = staffQueryService.findAllGuichetiersByFilialeId(filialeId);
        return guichetiers.stream()
            .map(this::toResponse)
            .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<UserProfileResponse> listChauffeursByFiliale(UUID filialeId, JwtClaims caller) {
        roleManager.assertCanViewEmployesByFiliale(caller, filialeId);
        
        List<Chauffeur> chauffeurs = staffQueryService.findAllChauffeursByFilialeId(filialeId);
        return chauffeurs.stream()
            .map(this::toResponse)
            .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public void createGuichetier(UUID filialeId, CreateGuichetierRequest request, JwtClaims caller) {
        roleManager.assertCanCreateEmployeByManagerLocal(caller);
        roleManager.assertManagerLocalCanManageFiliale(caller, filialeId);
        
        String email = request.getEmail().toLowerCase().strip();
        if (userRepository.existsByEmail(email)) {
            throw new EmailAlreadyExistsException(email);
        }
        
        Filiale filiale = filialeRepository.findById(filialeId)
            .orElseThrow(() -> new FilialeNotFoundException(filialeId.toString()));
        
        UUID newUserId = UUID.randomUUID();
        String tempPassword = "0000";
        
        LocalDateTime dateEmbauche = null;
        if (request.getDateEmbauche() != null && !request.getDateEmbauche().isBlank()) {
            try {
                dateEmbauche = LocalDateTime.parse(request.getDateEmbauche(), DATE_FORMATTER);
            } catch (Exception e) {
                log.warn("[MANAGER_LOCAL] Format date embauche invalide, utilisation null");
            }
        }
        
        Guichetier guichetier = Guichetier.builder()
            .idUser(newUserId)
            .name(request.getName().strip())
            .surname(request.getSurname().strip())
            .email(email)
            .phone(request.getPhone())
            .adresse(request.getAdresse())
            .agenceId(filiale.getAgenceId())
            .filialeId(filialeId)
            .poste(request.getPoste())
            .dateEmbauche(dateEmbauche)
            .isActive(true)
            .build();
        
        guichetierRepository.save(guichetier);
        
        
        eventPublisher.publishStaffToAuth(
            newUserId, email, tempPassword,
            Role.GUICHETIER.name(),
            request.getName().strip(),
            request.getSurname().strip(),
            request.getPhone(),
            request.getAdresse(),
            filialeId.toString(),
            filiale.getAgenceId().toString(),
            request.getPoste(),
            null
        );
        
        log.info("[MANAGER_LOCAL] Guichetier créé | userId={} filialeId={} agenceId={} par ml={}", 
                 newUserId, filialeId, filiale.getAgenceId(), caller.getUserId());
    }

    @Override
    @Transactional
    public void createChauffeur(UUID filialeId, CreateChauffeurRequest request, JwtClaims caller) {
        roleManager.assertCanCreateEmployeByManagerLocal(caller);
        roleManager.assertManagerLocalCanManageFiliale(caller, filialeId);
        
        String email = request.getEmail().toLowerCase().strip();
        if (userRepository.existsByEmail(email)) {
            throw new EmailAlreadyExistsException(email);
        }
        
        Filiale filiale = filialeRepository.findById(filialeId)
            .orElseThrow(() -> new FilialeNotFoundException(filialeId.toString()));
        
        UUID newUserId = UUID.randomUUID();
        String tempPassword = "0000";
        
        LocalDateTime dateEmbauche = null;
        if (request.getDateEmbauche() != null && !request.getDateEmbauche().isBlank()) {
            try {
                dateEmbauche = LocalDateTime.parse(request.getDateEmbauche(), DATE_FORMATTER);
            } catch (Exception e) {
                log.warn("[MANAGER_LOCAL] Format date embauche invalide, utilisation null");
            }
        }
        
        Chauffeur chauffeur = Chauffeur.builder()
            .idUser(newUserId)
            .name(request.getName().strip())
            .surname(request.getSurname().strip())
            .email(email)
            .phone(request.getPhone())
            .adresse(request.getAdresse())
            .agenceId(filiale.getAgenceId())
            .filialeId(filialeId)
            .numeroPermis(request.getNumeroPermis())
            .dateEmbauche(dateEmbauche)
            .disponible(true)
            .isActive(true)
            .build();
        
        chauffeurRepository.save(chauffeur);
        
       
        eventPublisher.publishStaffToAuth(
            newUserId, email, tempPassword,
            Role.CHAUFFEUR.name(),
            request.getName().strip(),
            request.getSurname().strip(),
            request.getPhone(),
            request.getAdresse(),
            filialeId.toString(),
            filiale.getAgenceId().toString(),
            null,
            request.getNumeroPermis()
        );
        
        log.info("[MANAGER_LOCAL] Chauffeur créé | userId={} filialeId={} agenceId={} par ml={}", 
                 newUserId, filialeId, filiale.getAgenceId(), caller.getUserId());
    }


    @Override
    @Transactional
    @CacheEvict(value = "profiles", key = "#employeId.toString()")
    public void deleteEmploye(UUID employeId, JwtClaims caller) {
        UserProfile employe = userRepository.findById(employeId)
            .orElseThrow(() -> new ProfileNotFoundException(employeId.toString()));
        
        // Vérifier que c'est bien un employé (Guichetier ou Chauffeur)
        if (employe.getRole() != Role.GUICHETIER && employe.getRole() != Role.CHAUFFEUR) {
            throw new ForbiddenException("Vous ne pouvez supprimer que des guichetiers ou chauffeurs.");
        }
        
        roleManager.assertCanDeleteUser(caller, employe);
        
        userRepository.delete(employe);
        
        log.info("[MANAGER_LOCAL] Employé supprimé | employeId={} par ml={}", employeId, caller.getUserId());
    }
    
    private UserProfileResponse toResponse(UserProfile p) {
        com.njila.njila_user_service.entity.AgentFiliale agent =
            (p instanceof com.njila.njila_user_service.entity.AgentFiliale)
                ? (com.njila.njila_user_service.entity.AgentFiliale) p : null;
        com.njila.njila_user_service.entity.EmployeFiliale employe =
            (p instanceof com.njila.njila_user_service.entity.EmployeFiliale)
                ? (com.njila.njila_user_service.entity.EmployeFiliale) p : null;

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
            .poste(p instanceof Guichetier ? ((Guichetier) p).getPoste() : null)
            .numeroPermis(p instanceof Chauffeur ? ((Chauffeur) p).getNumeroPermis() : null)
            .disponible(p instanceof Chauffeur ? ((Chauffeur) p).getDisponible() : null)
            .dateEmbauche(employe != null ? employe.getDateEmbauche() : null)
            .build();
    }

}