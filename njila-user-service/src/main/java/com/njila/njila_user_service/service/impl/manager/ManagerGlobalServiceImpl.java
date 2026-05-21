package com.njila.njila_user_service.service.impl.manager;

import com.njila.njila_user_service.dto.request.CreateManagerLocalRequest;
import com.njila.njila_user_service.dto.response.ManagerLocalResponse;
import com.njila.njila_user_service.dto.response.UserProfileResponse;
import com.njila.njila_user_service.entity.Filiale;
import com.njila.njila_user_service.entity.Agence;
import com.njila.njila_user_service.exception.AgenceNotFoundException;
import com.njila.njila_user_service.entity.ManagerLocal;
import com.njila.njila_user_service.entity.UserProfile;
import com.njila.njila_user_service.enums.Role;
import com.njila.njila_user_service.exception.EmailAlreadyExistsException;
import com.njila.njila_user_service.exception.FilialeNotFoundException;
import com.njila.njila_user_service.exception.ForbiddenException;
import com.njila.njila_user_service.exception.ManagerLocalAlreadyExistsException;
import com.njila.njila_user_service.middleware.JwtClaims;
import com.njila.njila_user_service.repository.FilialeRepository;
import com.njila.njila_user_service.repository.ManagerLocalRepository;
import com.njila.njila_user_service.repository.UserRepository;
import com.njila.njila_user_service.repository.AgenceRepository;
import com.njila.njila_user_service.service.ManagerGlobalService;
import com.njila.njila_user_service.service.RoleManager;
import com.njila.njila_user_service.events.publisher.EventPublisher;
import com.njila.njila_user_service.events.publisher.NotificationEventPublisher;
import com.njila.njila_user_service.service.impl.StaffQueryService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class ManagerGlobalServiceImpl implements ManagerGlobalService {

    private final UserRepository userRepository;
    private final ManagerLocalRepository managerLocalRepository;
    private final FilialeRepository filialeRepository;
    private final RoleManager roleManager;
    private final StaffQueryService staffQueryService;
    private final EventPublisher eventPublisher;
    private final NotificationEventPublisher notificationEventPublisher;
    private final AgenceRepository agenceRepository;

    // ── helper ──────────────────────────────────────────────────────────────
    private String getCallerFullName(JwtClaims caller) {
        return userRepository.findById(caller.getUserId())
            .map(u -> u.getName() + " " + u.getSurname())
            .orElse("Manager");
    }

    // ── LISTE STAFF ─────────────────────────────────────────────────────────

    @Override
    @Transactional(readOnly = true)
    public List<UserProfileResponse> listStaffByAgence(UUID agenceId, String type, JwtClaims caller) {
        roleManager.assertCanViewStaffByAgence(caller, agenceId);

        List<UserProfile> staff;
        if ("MANAGER_LOCAL".equalsIgnoreCase(type)) {
            staff = staffQueryService.findAllManagerLocauxByAgenceId(agenceId).stream()
                    .map(u -> (UserProfile) u)
                    .collect(Collectors.toList());
        } else if ("EMPLOYE".equalsIgnoreCase(type)) {
            staff = staffQueryService.findAllEmployesByAgenceId(agenceId);
        } else {
            staff = staffQueryService.findAllStaffByAgenceId(agenceId);
        }

        return staff.stream().map(this::toResponse).collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<UserProfileResponse> listEmployesByAgence(UUID agenceId, JwtClaims caller) {
        roleManager.assertCanViewStaffByAgence(caller, agenceId);
        return staffQueryService.findAllEmployesByAgenceId(agenceId).stream()
            .map(this::toResponse)
            .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<UserProfileResponse> listEmployesByAgenceAndFiliale(UUID agenceId, UUID filialeId, JwtClaims caller) {
        roleManager.assertManagerGlobalCanManageAgence(caller, agenceId);

        Filiale filiale = filialeRepository.findById(filialeId)
            .orElseThrow(() -> new FilialeNotFoundException(filialeId.toString()));

        if (!filiale.getAgenceId().equals(agenceId)) {
            throw new ForbiddenException("Cette filiale n'appartient pas à votre agence.");
        }

        return staffQueryService.findAllEmployesByAgenceAndFiliale(agenceId, filialeId).stream()
            .map(this::toResponse)
            .collect(Collectors.toList());
    }

    // ── CRÉATION MANAGER LOCAL ──────────────────────────────────────────────

    @Override
    @Transactional
    public ManagerLocalResponse createManagerLocal(UUID agenceId, CreateManagerLocalRequest request, JwtClaims caller) {
        roleManager.assertCanCreateStaffByManagerGlobal(caller);
        roleManager.assertManagerGlobalCanManageAgence(caller, agenceId);

        String email = request.getEmail().toLowerCase().strip();
        if (userRepository.existsByEmail(email)) {
            throw new EmailAlreadyExistsException(email);
        }

        UUID filialeId = UUID.fromString(request.getFilialeId());
        Filiale filiale = filialeRepository.findById(filialeId)
            .orElseThrow(() -> new FilialeNotFoundException(request.getFilialeId()));

        if (!filiale.getAgenceId().equals(agenceId)) {
            throw new ForbiddenException("La filiale spécifiée n'appartient pas à votre agence.");
        }

        // Vérification : une filiale ne peut avoir qu'un seul ManagerLocal
        if (managerLocalRepository.existsByFilialeId(filialeId)) {
            throw new ManagerLocalAlreadyExistsException(filiale.getNom());
        }

        // Récupérer l'agence pour avoir son nom
        Agence agence = agenceRepository.findById(agenceId)
            .orElseThrow(() -> new AgenceNotFoundException(agenceId.toString()));

        UUID newUserId = UUID.randomUUID();
        String tempPassword = "00000000";

        ManagerLocal managerLocal = ManagerLocal.builder()
            .idUser(newUserId)
            .name(request.getName().strip())
            .surname(request.getSurname().strip())
            .email(email)
            .phone(request.getPhone())
            .adresse(request.getAdresse())
            .agenceId(agenceId)
            .filialeId(filialeId)
            .isActive(true)
            .build();

        managerLocalRepository.save(managerLocal);

        eventPublisher.publishStaffToAuth(
            newUserId, email, tempPassword,
            Role.MANAGER_LOCAL.name(),
            request.getName().strip(),
            request.getSurname().strip(),
            request.getPhone(),
            request.getAdresse(),
            filialeId.toString(),
            agenceId.toString(),
            null,
            null
        );

        notificationEventPublisher.publishStaffCreated(
            newUserId.toString(),
            email,
            Role.MANAGER_LOCAL.name(),
            request.getName().strip(),
            request.getSurname().strip(),
            agence.getNom(),
            filiale.getNom(),
            caller.getUserId().toString(),
            getCallerFullName(caller)
        );

        log.info("[MANAGER_GLOBAL] ManagerLocal créé | userId={} agence={} filiale={} par mg={}",
                 newUserId, agence.getNom(), filiale.getNom(), caller.getUserId());

        return toManagerLocalResponse(managerLocal);
    }

    // ── SUPPRESSION STAFF ───────────────────────────────────────────────────

    @Override
    @Transactional
    @CacheEvict(value = "profiles", key = "#staffId.toString()")
    public void deleteStaff(UUID staffId, JwtClaims caller) {
        UserProfile staff = userRepository.findById(staffId)
            .orElseThrow(() -> new RuntimeException("Staff non trouvé"));

        roleManager.assertCanDeleteUser(caller, staff);
        userRepository.delete(staff);

        log.info("[MANAGER_GLOBAL] Staff supprimé | staffId={} par mg={}", staffId, caller.getUserId());
    }

    // ── MAPPERS ─────────────────────────────────────────────────────────────

    private UserProfileResponse toResponse(UserProfile p) {
        return UserProfileResponse.builder()
            .idUser(p.getIdUser())
            .name(p.getName())
            .surname(p.getSurname())
            .email(p.getEmail())
            .phone(p.getPhone())
            .adresse(p.getAdresse())
            .photoProfil(p.getPhotoProfil())
            .role(p.getRole())
            .isActive(p.isActive())
            .dateInscription(p.getDateInscription())
            .derniereConnexion(p.getDerniereConnexion())
            .build();
    }

    private ManagerLocalResponse toManagerLocalResponse(ManagerLocal ml) {
        return ManagerLocalResponse.builder()
            .idUser(ml.getIdUser())
            .name(ml.getName())
            .surname(ml.getSurname())
            .email(ml.getEmail())
            .phone(ml.getPhone())
            .adresse(ml.getAdresse())
            .photoProfil(ml.getPhotoProfil())
            .agenceId(ml.getAgenceId())
            .filialeId(ml.getFilialeId())
            .isActive(ml.isActive())
            .dateInscription(ml.getDateInscription())
            .derniereConnexion(ml.getDerniereConnexion())
            .build();
    }
}