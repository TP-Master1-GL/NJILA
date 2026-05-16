package com.njila.njila_user_service.service.impl;

import com.njila.njila_user_service.dto.request.*;
import com.njila.njila_user_service.dto.response.AvisResponse;
import com.njila.njila_user_service.dto.response.UserProfileResponse;
import com.njila.njila_user_service.entity.*;
import com.njila.njila_user_service.enums.Role;
import com.njila.njila_user_service.enums.UserEventType;
import com.njila.njila_user_service.events.publisher.EventPublisher;
import com.njila.njila_user_service.exception.*;
import com.njila.njila_user_service.middleware.JwtClaims;
import com.njila.njila_user_service.observer.IUserObserver;
import com.njila.njila_user_service.observer.IUserSubject;
import com.njila.njila_user_service.observer.UserEvent;
import com.njila.njila_user_service.events.publisher.NotificationEventPublisher;
import com.njila.njila_user_service.repository.*;
import com.njila.njila_user_service.service.*;
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
    private final NotificationEventPublisher notificationEventPublisher;
    private final RedisCacheInvalidator cacheInvalidator;
    private final CacheManager cacheManager;
    private final StaffQueryService staffQueryService;
    
    // Services de délégation pour les staffs (NOUVEAUX)
    private final AdministrateurService administrateurService;
    private final ManagerGlobalService managerGlobalService;
    private final ManagerLocalService managerLocalService;

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

    // ──────────────────────────────────────────────────────────────────────────
    // ── PROFIL (VOYAGEUR) ─── NON MODIFIÉ ─────────────────────────────────────
    // ──────────────────────────────────────────────────────────────────────────

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
		boolean emailChanged = false;
		
		// Vérifier si l'email a changé
		if (request.getEmail() != null && !request.getEmail().isBlank() 
		    && !request.getEmail().equalsIgnoreCase(profile.getEmail())) {
		    
		    String newEmail = request.getEmail().toLowerCase().strip();
		    if (userRepository.existsByEmail(newEmail)) {
		        throw new EmailAlreadyExistsException(newEmail);
		    }
		    profile.setEmail(newEmail);
		    emailChanged = true;
		    changed = true;
		}
		
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
		    // Envoyer la notification
		    notificationEventPublisher.publishProfileUpdated(
		        userId.toString(),
		        profile.getEmail(),
		        profile.getName(),
		        profile.getSurname(),
		        caller != null ? caller.getUserId().toString() : "SYSTEM"
		    );
		    
		    // Envoyer l'événement à auth-service via RabbitMQ
		    eventPublisher.publishUserUpdateToAuth(
		        userId.toString(),
		        profile.getEmail(),
		        profile.getName(),
		        profile.getSurname(),
		        profile.getPhone(),
		        profile.getAdresse(),
		        profile.getPhotoProfil(),
		        emailChanged
		    );
		    
		    // Notifier les observateurs
		    Map<String, Object> payload = new HashMap<>();
		    payload.put("userId", userId.toString());
		    payload.put("email", profile.getEmail());
		    payload.put("emailChanged", emailChanged);
		    payload.put("name", profile.getName());
		    payload.put("surname", profile.getSurname());
		    payload.put("phone", profile.getPhone());
		    payload.put("adresse", profile.getAdresse());
		    
		    notifyObservers(UserEvent.of(
		        UserEventType.PROFIL_MODIFIER,
		        caller != null ? caller.getUserId() : null,
		        userId,
		        payload
		    ));
		}

		log.info("[SERVICE] Profil mis à jour | userId={} emailChanged={}", userId, emailChanged);
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

		    // Envoyer l'événement à auth-service pour mettre à jour la photo
		    eventPublisher.publishUserUpdateToAuth(
		        userId.toString(),
		        profile.getEmail(),
		        profile.getName(),
		        profile.getSurname(),
		        profile.getPhone(),
		        profile.getAdresse(),
		        newPhoto,
		        false  // email unchanged
		    );

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

    // ──────────────────────────────────────────────────────────────────────────
    // ── AVIS (VOYAGEUR) ─── NON MODIFIÉ ───────────────────────────────────────
    // ──────────────────────────────────────────────────────────────────────────

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

    // ──────────────────────────────────────────────────────────────────────────
    // ── MANAGER GLOBAL ─── DÉLÉGUÉ À ManagerGlobalService ─────────────────────
    // ──────────────────────────────────────────────────────────────────────────

    @Override
    @Transactional(readOnly = true)
    public List<UserProfileResponse> listStaffByAgence(UUID agenceId, String type, JwtClaims caller) {
        return managerGlobalService.listStaffByAgence(agenceId, type, caller);
    }

    @Override
    @Transactional(readOnly = true)
    public List<UserProfileResponse> listEmployesByAgence(UUID agenceId, JwtClaims caller) {
        return managerGlobalService.listEmployesByAgence(agenceId, caller);
    }

    @Override
    @Transactional(readOnly = true)
    public List<UserProfileResponse> listEmployesByAgenceAndFiliale(UUID agenceId, UUID filialeId, JwtClaims caller) {
        return managerGlobalService.listEmployesByAgenceAndFiliale(agenceId, filialeId, caller);
    }

    @Override
    @Transactional
    public void createManagerLocal(UUID agenceId, CreateManagerLocalRequest request, JwtClaims caller) {
        managerGlobalService.createManagerLocal(agenceId, request, caller);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // ── MANAGER LOCAL ─── DÉLÉGUÉ À ManagerLocalService ───────────────────────
    // ──────────────────────────────────────────────────────────────────────────

    @Override
    @Transactional(readOnly = true)
    public List<UserProfileResponse> listEmployesByFiliale(UUID filialeId, JwtClaims caller) {
        return managerLocalService.listEmployesByFiliale(filialeId, caller);
    }

    @Override
    @Transactional(readOnly = true)
    public List<UserProfileResponse> listGuichetiersByFiliale(UUID filialeId, JwtClaims caller) {
        return managerLocalService.listGuichetiersByFiliale(filialeId, caller);
    }

    @Override
    @Transactional(readOnly = true)
    public List<UserProfileResponse> listChauffeursByFiliale(UUID filialeId, JwtClaims caller) {
        return managerLocalService.listChauffeursByFiliale(filialeId, caller);
    }

    @Override
    @Transactional
    public void createGuichetier(UUID filialeId, CreateGuichetierRequest request, JwtClaims caller) {
        managerLocalService.createGuichetier(filialeId, request, caller);
    }

    @Override
    @Transactional
    public void createChauffeur(UUID filialeId, CreateChauffeurRequest request, JwtClaims caller) {
        managerLocalService.createChauffeur(filialeId, request, caller);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // ── ADMIN ─── DÉLÉGUÉ À AdministrateurService ─────────────────────────────
    // ──────────────────────────────────────────────────────────────────────────

    @Override
    @Transactional
    public void createManagerGlobal(CreateManagerGlobalRequest request, JwtClaims caller) {
        administrateurService.createManagerGlobal(request, caller);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // ── SUPPRESSION STAFF ─── DÉLÉGUÉ SELON LE RÔLE ───────────────────────────
    // ──────────────────────────────────────────────────────────────────────────

    @Override
    @Transactional
    public void deleteStaff(UUID staffId, JwtClaims caller) {
        UserProfile staff = userRepository.findById(staffId)
            .orElseThrow(() -> new ProfileNotFoundException(staffId.toString()));

        if (staff.getRole() == Role.VOYAGEUR) {
            throw new ForbiddenException("Impossible de supprimer un compte voyageur via cette endpoint.");
        }

        roleManager.assertCanDeleteUser(caller, staff);

        // Déléguer selon le rôle
        switch (staff.getRole()) {
            case MANAGER_GLOBAL:
                administrateurService.deleteManagerGlobal(staffId, caller);
                break;
            case MANAGER_LOCAL:
            case GUICHETIER:
            case CHAUFFEUR:
                managerLocalService.deleteEmploye(staffId, caller);
                break;
            default:
                throw new ForbiddenException("Suppression non supportée pour ce rôle: " + staff.getRole());
        }

        evictUserLists();
        var profileCache = cacheManager.getCache("profiles");
        if (profileCache != null) profileCache.evict(staffId.toString());

        log.info("[SERVICE] Staff supprimé | staffId={}", staffId);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // ── HELPERS ─── NON MODIFIÉS ──────────────────────────────────────────────
    // ──────────────────────────────────────────────────────────────────────────

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
            .poste(p instanceof Guichetier ? ((Guichetier) p).getPoste() : null)
            .numeroPermis(p instanceof Chauffeur ? ((Chauffeur) p).getNumeroPermis() : null)
            .disponible(p instanceof Chauffeur ? ((Chauffeur) p).getDisponible() : null)
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
