package com.njila.njila_user_service.service.impl.admin;

import com.njila.njila_user_service.dto.request.CreateManagerGlobalRequest;
import com.njila.njila_user_service.dto.response.ManagerGlobalResponse;
import com.njila.njila_user_service.entity.Agence;
import com.njila.njila_user_service.entity.ManagerGlobal;
import com.njila.njila_user_service.entity.UserProfile;
import com.njila.njila_user_service.enums.Role;
import com.njila.njila_user_service.exception.AgenceNotFoundException;
import com.njila.njila_user_service.exception.EmailAlreadyExistsException;
import com.njila.njila_user_service.exception.ManagerGlobalAlreadyExistsException;
import com.njila.njila_user_service.exception.ProfileNotFoundException;
import com.njila.njila_user_service.middleware.JwtClaims;
import com.njila.njila_user_service.repository.AgenceRepository;
import com.njila.njila_user_service.repository.ManagerGlobalRepository;
import com.njila.njila_user_service.repository.UserRepository;
import com.njila.njila_user_service.service.AdministrateurService;
import com.njila.njila_user_service.service.RoleManager;
import com.njila.njila_user_service.events.publisher.EventPublisher;
import com.njila.njila_user_service.events.publisher.NotificationEventPublisher;
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
public class AdministrateurServiceImpl implements AdministrateurService {

    private final UserRepository userRepository;
    private final ManagerGlobalRepository managerGlobalRepository;
    private final AgenceRepository agenceRepository;
    private final RoleManager roleManager;
    private final EventPublisher eventPublisher;
    private final NotificationEventPublisher notificationEventPublisher;

    private String getCallerFullName(JwtClaims caller) {
        return userRepository.findById(caller.getUserId())
            .map(u -> u.getName() + " " + u.getSurname())
            .orElse("Admin");
    }

    @Override
    @Transactional
    public ManagerGlobalResponse createManagerGlobal(CreateManagerGlobalRequest request, JwtClaims caller) {
        roleManager.assertIsAdmin(caller);

        String email = request.getEmail().toLowerCase().strip();
        if (userRepository.existsByEmail(email)) {
            throw new EmailAlreadyExistsException(email);
        }

        UUID agenceId = UUID.fromString(request.getAgenceId());
        Agence agence = agenceRepository.findById(agenceId)
            .orElseThrow(() -> new AgenceNotFoundException(request.getAgenceId()));

        // Vérification : une agence ne peut avoir qu'un seul ManagerGlobal
        if (managerGlobalRepository.existsByAgenceId(agenceId)) {
            throw new ManagerGlobalAlreadyExistsException(agence.getNom());
        }

        UUID newUserId = UUID.randomUUID();
        String tempPassword = "00000000";

        ManagerGlobal managerGlobal = ManagerGlobal.builder()
            .idUser(newUserId)
            .name(request.getName().strip())
            .surname(request.getSurname().strip())
            .email(email)
            .phone(request.getPhone())
            .adresse(request.getAdresse())
            .agenceId(agenceId)
            .isActive(true)
            .build();

        managerGlobalRepository.save(managerGlobal);

        eventPublisher.publishStaffToAuth(
            newUserId, email, tempPassword,
            Role.MANAGER_GLOBAL.name(),
            request.getName().strip(),
            request.getSurname().strip(),
            request.getPhone(),
            request.getAdresse(),
            null,
            agenceId.toString(),
            null,
            null
        );

        notificationEventPublisher.publishStaffCreated(
            newUserId.toString(),
            email,
            Role.MANAGER_GLOBAL.name(),
            request.getName().strip(),
            request.getSurname().strip(),
            agence.getNom(),
            null,
            caller.getUserId().toString(),
            getCallerFullName(caller)
        );

        log.info("[ADMIN] ManagerGlobal créé | userId={} agence={} par admin={}",
                 newUserId, agence.getNom(), caller.getUserId());

        return toResponse(managerGlobal);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ManagerGlobalResponse> listAllManagersGlobal(JwtClaims caller) {
        roleManager.assertIsAdmin(caller);
        return managerGlobalRepository.findAll().stream()
            .map(this::toResponse)
            .collect(Collectors.toList());
    }

    @Override
    @Transactional
    @CacheEvict(value = "profiles", key = "#managerId.toString()")
    public void deleteManagerGlobal(UUID managerId, JwtClaims caller) {
        roleManager.assertIsAdmin(caller);

        ManagerGlobal managerGlobal = managerGlobalRepository.findById(managerId)
            .orElseThrow(() -> new RuntimeException("ManagerGlobal non trouvé"));

        notificationEventPublisher.publishStaffDeleted(
            managerGlobal.getIdUser().toString(),
            managerGlobal.getEmail(),
            Role.MANAGER_GLOBAL.name(),
            managerGlobal.getAgenceId().toString(),
            null,
            caller.getUserId().toString(),
            getCallerFullName(caller)
        );

        managerGlobalRepository.delete(managerGlobal);
        log.info("[ADMIN] ManagerGlobal supprimé | userId={} par admin={}", managerId, caller.getUserId());
    }

    private ManagerGlobalResponse toResponse(ManagerGlobal mg) {
        return ManagerGlobalResponse.builder()
            .idUser(mg.getIdUser())
            .name(mg.getName())
            .surname(mg.getSurname())
            .email(mg.getEmail())
            .phone(mg.getPhone())
            .adresse(mg.getAdresse())
            .photoProfil(mg.getPhotoProfil())
            .agenceId(mg.getAgenceId())
            .isActive(mg.isActive())
            .dateInscription(mg.getDateInscription())
            .derniereConnexion(mg.getDerniereConnexion())
            .build();
    }
}