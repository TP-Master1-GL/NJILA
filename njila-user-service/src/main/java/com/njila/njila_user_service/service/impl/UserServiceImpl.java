package com.njila.njila_user_service.service.impl;

import com.njila.njila_user_service.dto.request.*;
import com.njila.njila_user_service.dto.response.AvisResponse;
import com.njila.njila_user_service.dto.response.UserProfileResponse;
import com.njila.njila_user_service.entity.Avis;
import com.njila.njila_user_service.entity.Chauffeur;
import com.njila.njila_user_service.entity.Guichetier;
import com.njila.njila_user_service.entity.UserProfile;
import com.njila.njila_user_service.entity.Voyageur;
import com.njila.njila_user_service.enums.Role;
import com.njila.njila_user_service.enums.UserEventType;
import com.njila.njila_user_service.events.publisher.EventPublisher;
import com.njila.njila_user_service.exception.*;
import com.njila.njila_user_service.middleware.JwtClaims;
import com.njila.njila_user_service.observer.IUserObserver;
import com.njila.njila_user_service.observer.IUserSubject;
import com.njila.njila_user_service.observer.UserEvent;
import com.njila.njila_user_service.repository.*;
import com.njila.njila_user_service.service.RedisCacheInvalidator;
import com.njila.njila_user_service.service.RoleManager;
import com.njila.njila_user_service.service.UserService;
import com.njila.njila_user_service.service.impl.StaffQueryService;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class UserServiceImpl implements UserService, IUserSubject {

    private final UserRepository userRepository;
    private final AvisRepository avisRepository;
    private final AgenceRepository agenceRepository;
    private final FilialeRepository filialeRepository;
    private final ManagerGlobalRepository managerGlobalRepository;
    private final ManagerLocalRepository managerLocalRepository;
    private final GuichetierRepository guichetierRepository;
    private final ChauffeurRepository chauffeurRepository;
    private final RoleManager roleManager;
    private final EventPublisher eventPublisher;
    private final RedisCacheInvalidator cacheInvalidator;
    private final CacheManager cacheManager;
    private final StaffQueryService staffQueryService;

    private final List<IUserObserver> observers = new ArrayList<>();

    @PostConstruct
    public void init() {
        subscribe(eventPublisher);
        subscribe(cacheInvalidator);
    }

    // ── IUserSubject ────────────────────────────────────────────────────────

    @Override
    public void subscribe(IUserObserver observer) { observers.add(observer); }
    @Override
    public void unsubscribe(IUserObserver observer) { observers.remove(observer); }
    @Override
    public void notifyObservers(UserEvent event) {
        observers.forEach(o -> {
            try { o.onUserEvent(event); }
            catch (Exception e) { log.error("[OBSERVER] Erreur: {}", e.getMessage()); }
        });
    }

    // ── PROFIL ──────────────────────────────────────────────────────────────

    @Override
    @Cacheable(value = "profiles", key = "#userId.toString()", unless = "#result == null")
    @Transactional(readOnly = true)
    public UserProfileResponse getProfile(UUID userId, JwtClaims caller) {
        roleManager.assertCanReadProfile(caller, userId);
        UserProfile profile = userRepository.findById(userId)
            .orElseThrow(() -> new ProfileNotFoundException(userId.toString()));
        return toResponse(profile);
    }

    @Override
    @CacheEvict(value = "profiles", key = "#userId.toString()")
    @Transactional
    public UserProfileResponse updateProfile(UUID userId, UpdateProfileRequest request, JwtClaims caller) {
        roleManager.assertCanUpdateProfile(caller, userId);

        UserProfile profile = userRepository.findById(userId)
            .orElseThrow(() -> new ProfileNotFoundException(userId.toString()));

        boolean changed = false;
        if (request.getName() != null && !request.getName().isBlank()) {
            profile.setName(request.getName().strip());
            changed = true;
        }
        if (request.getSurname() != null && !request.getSurname().isBlank()) {
            profile.setSurname(request.getSurname().strip());
            changed = true;
        }
        if (request.getPhone() != null) {
            profile.setPhone(request.getPhone());
            changed = true;
        }
        if (request.getAdresse() != null) {
            profile.setAdresse(request.getAdresse());
            changed = true;
        }

        userRepository.save(profile);

        if (changed) {
            notifyObservers(UserEvent.of(
                UserEventType.PROFIL_MODIFIER,
                caller != null ? caller.getUserId() : null,
                userId,
                Map.of("userId", userId.toString(), "email", profile.getEmail())
            ));
        }

        log.info("[SERVICE] Profil mis à jour | userId={}", userId);
        return toResponse(profile);
    }

    @Override
    @CacheEvict(value = "profiles", key = "#userId.toString()")
    @Transactional
    public UserProfileResponse updatePhoto(UUID userId, UpdatePhotoRequest request, JwtClaims caller) {
        roleManager.assertCanUpdateProfile(caller, userId);

        UserProfile profile = userRepository.findById(userId)
            .orElseThrow(() -> new ProfileNotFoundException(userId.toString()));

        String newPhoto = request.getPhotoProfil();
        if (newPhoto != null && !newPhoto.equals(profile.getPhotoProfil())) {
            profile.setPhotoProfil(newPhoto);
            userRepository.save(profile);

            notifyObservers(UserEvent.of(
                UserEventType.PHOTO_MISE_A_JOUR,
                caller != null ? caller.getUserId() : null,
                userId,
                Map.of("userId", userId.toString(), "photoUrl", newPhoto)
            ));

            eventPublisher.publishPhotoUpdated(userId.toString(), newPhoto);
            log.info("[SERVICE] Photo mise à jour | userId={}", userId);
        }

        return toResponse(profile);
    }

    @Override
    @CacheEvict(value = "profiles", key = "#userId.toString()")
    @Transactional
    public void deleteProfile(UUID userId, JwtClaims caller) {
        roleManager.assertCanDeleteProfile(caller);
        UserProfile profile = userRepository.findById(userId)
            .orElseThrow(() -> new ProfileNotFoundException(userId.toString()));
        userRepository.delete(profile);
        notifyObservers(UserEvent.of(
            UserEventType.COMPTE_SUPPRIMER,
            caller.getUserId(),
            userId,
            Map.of("userId", userId.toString())
        ));
        log.info("[SERVICE] Profil supprimé | userId={}", userId);
    }

    @Override
    @Cacheable(value = "userLists", key = "'all'")
    @Transactional(readOnly = true)
    public List<UserProfileResponse> listUsers(JwtClaims caller) {
        roleManager.assertIsAdmin(caller);
        return userRepository.findAll().stream().map(this::toResponse).collect(Collectors.toList());
    }

    // ── AVIS ────────────────────────────────────────────────────────────────

    @Override
    @Transactional
    public AvisResponse submitAvis(UUID userId, AvisRequest request, JwtClaims caller) {
        roleManager.assertCanSubmitAvis(caller);
        if (caller != null && !caller.getUserId().equals(userId)) {
            throw new ForbiddenException("Vous ne pouvez soumettre un avis qu'en votre propre nom.");
        }

        UserProfile auteur = userRepository.findById(userId)
            .orElseThrow(() -> new ProfileNotFoundException(userId.toString()));

        UUID agenceId = UUID.fromString(request.getAgenceId());

        avisRepository.findByAuteurIdUserAndAgenceId(userId, agenceId).ifPresent(existing -> {
            throw new AvisAlreadyExistsException();
        });

        Avis avis = Avis.builder()
            .auteur(auteur)
            .agenceId(agenceId)
            .agenceNom(request.getAgenceNom())
            .note(request.getNote())
            .commentaire(request.getCommentaire())
            .visible(true)
            .build();

        avisRepository.save(avis);

        eventPublisher.publishAvisSubmitted(
            userId.toString(), request.getAgenceId(),
            request.getAgenceNom(), request.getNote(), request.getCommentaire()
        );

        log.info("[SERVICE] Avis soumis | userId={}", userId);
        return toAvisResponse(avis, auteur);
    }

    @Override
    @Transactional(readOnly = true)
    public List<AvisResponse> getUserAvis(UUID userId, JwtClaims caller) {
        roleManager.assertCanReadProfile(caller, userId);
        UserProfile auteur = userRepository.findById(userId)
            .orElseThrow(() -> new ProfileNotFoundException(userId.toString()));
        return avisRepository.findAllByAuteurIdUser(userId)
            .stream().map(a -> toAvisResponse(a, auteur)).collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public Page<AvisResponse> getAgenceAvis(UUID agenceId, Pageable pageable) {
        return avisRepository.findAllByAgenceIdAndVisibleTrue(agenceId, pageable)
            .map(avis -> toAvisResponse(avis, avis.getAuteur()));
    }

    @Override
    @Transactional
    public void deleteAvis(UUID userId, UUID avisId, JwtClaims caller) {
        Avis avis = avisRepository.findById(avisId)
            .orElseThrow(() -> new ProfileNotFoundException("Avis introuvable : " + avisId));
        roleManager.assertCanDeleteAvis(caller, avis.getAuteur().getIdUser());
        avisRepository.delete(avis);
        log.info("[SERVICE] Avis supprimé | avisId={}", avisId);
    }

    @Override
    @Transactional(readOnly = true)
    public double getNoteMoyenne(UUID agenceId) {
        Double moyenne = avisRepository.getNoteMoyenneByAgenceId(agenceId);
        return moyenne != null ? Math.round(moyenne * 10.0) / 10.0 : 0.0;
    }

    // ── MANAGER GLOBAL (délégué à ManagerGlobalService) ─────────────────────
    // Ces méthodes sont maintenant dans ManagerGlobalService
    // On garde les signatures mais on délègue ou on marque @Deprecated

    @Override
    @Transactional(readOnly = true)
    public List<UserProfileResponse> listStaffByAgence(UUID agenceId, String type, JwtClaims caller) {
        // Délégation à ManagerGlobalService via le contexte Spring
        // Pour éviter les dépendances circulaires, on peut soit :
        // 1. Injecter ManagerGlobalService (attention aux cycles)
        // 2. Utiliser directement StaffQueryService
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
            .map(this::toResponse).collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<UserProfileResponse> listEmployesByAgenceAndFiliale(UUID agenceId, UUID filialeId, JwtClaims caller) {
        roleManager.assertManagerGlobalCanManageAgence(caller, agenceId);
        
        var filiale = filialeRepository.findById(filialeId)
            .orElseThrow(() -> new FilialeNotFoundException(filialeId.toString()));
        
        if (!filiale.getAgenceId().equals(agenceId)) {
            throw new ForbiddenException("Cette filiale n'appartient pas à votre agence.");
        }
        
        return staffQueryService.findAllEmployesByAgenceAndFiliale(agenceId, filialeId).stream()
            .map(this::toResponse).collect(Collectors.toList());
    }

    @Override
    @Transactional
    public void createManagerLocal(UUID agenceId, CreateManagerLocalRequest request, JwtClaims caller) {
        roleManager.assertCanCreateStaffByManagerGlobal(caller);
        roleManager.assertManagerGlobalCanManageAgence(caller, agenceId);
        
        String email = request.getEmail().toLowerCase().strip();
        if (userRepository.existsByEmail(email)) {
            throw new EmailAlreadyExistsException(email);
        }
        
        UUID filialeId = UUID.fromString(request.getFilialeId());
        var filiale = filialeRepository.findById(filialeId)
            .orElseThrow(() -> new FilialeNotFoundException(request.getFilialeId()));
        
        if (!filiale.getAgenceId().equals(agenceId)) {
            throw new ForbiddenException("La filiale spécifiée n'appartient pas à votre agence.");
        }
        
        UUID newUserId = UUID.randomUUID();
        var managerLocal = com.njila.njila_user_service.entity.ManagerLocal.builder()
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
        evictUserLists();
        
        log.info("[SERVICE] ManagerLocal créé | userId={} agenceId={} filialeId={}", newUserId, agenceId, filialeId);
    }

    // ── MANAGER LOCAL (délégué) ─────────────────────────────────────────────

    @Override
    @Transactional(readOnly = true)
    public List<UserProfileResponse> listEmployesByFiliale(UUID filialeId, JwtClaims caller) {
        roleManager.assertCanViewEmployesByFiliale(caller, filialeId);
        return staffQueryService.findAllEmployesByFilialeId(filialeId).stream()
            .map(this::toResponse).collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<UserProfileResponse> listGuichetiersByFiliale(UUID filialeId, JwtClaims caller) {
        roleManager.assertCanViewEmployesByFiliale(caller, filialeId);
        return staffQueryService.findAllGuichetiersByFilialeId(filialeId).stream()
            .map(this::toResponse).collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<UserProfileResponse> listChauffeursByFiliale(UUID filialeId, JwtClaims caller) {
        roleManager.assertCanViewEmployesByFiliale(caller, filialeId);
        return staffQueryService.findAllChauffeursByFilialeId(filialeId).stream()
            .map(this::toResponse).collect(Collectors.toList());
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
        
        var filiale = filialeRepository.findById(filialeId)
            .orElseThrow(() -> new FilialeNotFoundException(filialeId.toString()));
        
        UUID newUserId = UUID.randomUUID();
        var guichetier = Guichetier.builder()
            .idUser(newUserId)
            .name(request.getName().strip())
            .surname(request.getSurname().strip())
            .email(email)
            .phone(request.getPhone())
            .adresse(request.getAdresse())
            .agenceId(filiale.getAgenceId())
            .filialeId(filialeId)
            .poste(request.getPoste())
            .isActive(true)
            .build();
        
        guichetierRepository.save(guichetier);
        evictUserLists();
        
        log.info("[SERVICE] Guichetier créé | userId={} filialeId={}", newUserId, filialeId);
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
        
        var filiale = filialeRepository.findById(filialeId)
            .orElseThrow(() -> new FilialeNotFoundException(filialeId.toString()));
        
        UUID newUserId = UUID.randomUUID();
        var chauffeur = Chauffeur.builder()
            .idUser(newUserId)
            .name(request.getName().strip())
            .surname(request.getSurname().strip())
            .email(email)
            .phone(request.getPhone())
            .adresse(request.getAdresse())
            .agenceId(filiale.getAgenceId())
            .filialeId(filialeId)
            .numeroPermis(request.getNumeroPermis())
            .disponible(true)
            .isActive(true)
            .build();
        
        chauffeurRepository.save(chauffeur);
        evictUserLists();
        
        log.info("[SERVICE] Chauffeur créé | userId={} filialeId={}", newUserId, filialeId);
    }

    // ── ADMIN ───────────────────────────────────────────────────────────────

    @Override
    @Transactional
    public void createManagerGlobal(CreateManagerGlobalRequest request, JwtClaims caller) {
        roleManager.assertIsAdmin(caller);
        
        String email = request.getEmail().toLowerCase().strip();
        if (userRepository.existsByEmail(email)) {
            throw new EmailAlreadyExistsException(email);
        }
        
        UUID agenceId = UUID.fromString(request.getAgenceId());
        agenceRepository.findById(agenceId)
            .orElseThrow(() -> new AgenceNotFoundException(request.getAgenceId()));
        
        UUID newUserId = UUID.randomUUID();
        var managerGlobal = com.njila.njila_user_service.entity.ManagerGlobal.builder()
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
        evictUserLists();
        
        log.info("[SERVICE] ManagerGlobal créé | userId={} agenceId={}", newUserId, agenceId);
    }

    // ── SUPPRESSION STAFF ───────────────────────────────────────────────────

    @Override
    @Transactional
    public void deleteStaff(UUID staffId, JwtClaims caller) {
        UserProfile staff = userRepository.findById(staffId)
            .orElseThrow(() -> new ProfileNotFoundException(staffId.toString()));
        
        if (staff.getRole() == Role.VOYAGEUR) {
            throw new ForbiddenException("Impossible de supprimer un compte voyageur via cette endpoint.");
        }
        
        roleManager.assertCanDeleteUser(caller, staff);
        
        if (staff.getRole() == Role.MANAGER_GLOBAL && caller.getRole() != Role.ADMINISTRATEUR) {
            throw new ForbiddenException("Seul un Administrateur peut supprimer un ManagerGlobal.");
        }
        
        userRepository.delete(staff);
        evictUserLists();
        
        var profileCache = cacheManager.getCache("profiles");
        if (profileCache != null) profileCache.evict(staffId.toString());
        
        log.info("[SERVICE] Staff supprimé | staffId={}", staffId);
    }

    // ── HELPERS ─────────────────────────────────────────────────────────────

    private void evictUserLists() {
        var cache = cacheManager.getCache("userLists");
        if (cache != null) cache.clear();
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
            .poste(p instanceof com.njila.njila_user_service.entity.Guichetier
                ? ((com.njila.njila_user_service.entity.Guichetier) p).getPoste() : null)
            .numeroPermis(p instanceof com.njila.njila_user_service.entity.Chauffeur
                ? ((com.njila.njila_user_service.entity.Chauffeur) p).getNumeroPermis() : null)
            .disponible(p instanceof com.njila.njila_user_service.entity.Chauffeur
                ? ((com.njila.njila_user_service.entity.Chauffeur) p).getDisponible() : null)
            .dateEmbauche(employe != null ? employe.getDateEmbauche() : null)
            .historiqueResa(p instanceof Voyageur ? ((Voyageur) p).getHistoriqueResa() : null)
            .build();
    }

    private AvisResponse toAvisResponse(Avis avis, UserProfile auteur) {
        return AvisResponse.builder()
            .id(avis.getId())
            .agenceId(avis.getAgenceId())
            .agenceNom(avis.getAgenceNom())
            .auteurName(auteur.getName())
            .auteurSurname(auteur.getSurname())
            .note(avis.getNote())
            .commentaire(avis.getCommentaire())
            .visible(avis.isVisible())
            .createdAt(avis.getCreatedAt())
            .updatedAt(avis.getUpdatedAt())
            .build();
    }
}