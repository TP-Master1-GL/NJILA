package com.njila.njila_user_service.service.impl;

import com.njila.njila_user_service.config.RabbitMQConfig;
import com.njila.njila_user_service.dto.request.AvisRequest;
import com.njila.njila_user_service.dto.request.CreateStaffRequest;
import com.njila.njila_user_service.dto.request.UpdatePhotoRequest;
import com.njila.njila_user_service.dto.request.UpdateProfileRequest;
import com.njila.njila_user_service.dto.response.AvisResponse;
import com.njila.njila_user_service.dto.response.UserProfileResponse;
import com.njila.njila_user_service.entity.Agence;
import com.njila.njila_user_service.entity.Avis;
import com.njila.njila_user_service.entity.Filiale;
import com.njila.njila_user_service.entity.UserProfile;
import com.njila.njila_user_service.enums.Role;
import com.njila.njila_user_service.enums.UserEventType;
import com.njila.njila_user_service.events.publisher.EventPublisher;
import com.njila.njila_user_service.exception.*;
import com.njila.njila_user_service.middleware.JwtClaims;
import com.njila.njila_user_service.observer.IUserObserver;
import com.njila.njila_user_service.observer.IUserSubject;
import com.njila.njila_user_service.observer.UserEvent;
import com.njila.njila_user_service.repository.AgenceRepository;
import com.njila.njila_user_service.repository.AvisRepository;
import com.njila.njila_user_service.repository.FilialeRepository;
import com.njila.njila_user_service.repository.UserRepository;
import com.njila.njila_user_service.service.RedisCacheInvalidator;
import com.njila.njila_user_service.service.RoleManager;
import com.njila.njila_user_service.service.UserService;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ThreadLocalRandom;

/**
 * UserServiceImpl — logique métier complète v2.0.
 * 
 * Modifications majeures :
 * - createStaff() sauvegarde d'abord en base, puis publie vers auth-service
 * - Ajout de la validation Agence/Filiale avant création
 * - Génération de l'UUID côté user-service
 * - Suppression de la dépendance à l'ancien consumer staff.created
 * - Mot de passe temporaire fixé à "0000" pour les nouveaux comptes staff
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class UserServiceImpl implements UserService, IUserSubject {

    private final UserRepository      userRepository;
    private final AvisRepository      avisRepository;
    private final AgenceRepository    agenceRepository;
    private final FilialeRepository   filialeRepository;
    private final RoleManager         roleManager;
    private final EventPublisher      eventPublisher;
    private final RedisCacheInvalidator cacheInvalidator;
    private final RabbitTemplate      rabbitTemplate;
    private final CacheManager        cacheManager;

    private final List<IUserObserver> observers = new ArrayList<>();

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ISO_LOCAL_DATE_TIME;

    @PostConstruct
    public void init() {
        subscribe(eventPublisher);
        subscribe(cacheInvalidator);
    }

    // ── IUserSubject ────────────────────────────────────────────────────────

    @Override
    public void subscribe(IUserObserver observer) {
        observers.add(observer);
    }

    @Override
    public void unsubscribe(IUserObserver observer) {
        observers.remove(observer);
    }

    @Override
    public void notifyObservers(UserEvent event) {
        observers.forEach(o -> {
            try { o.onUserEvent(event); }
            catch (Exception e) {
                log.error("[OBSERVER] Erreur dans {} : {}",
                    o.getClass().getSimpleName(), e.getMessage());
            }
        });
    }

    // ── GET PROFILE ─────────────────────────────────────────────────────────

    @Override
    @Cacheable(value = "profiles", key = "#userId.toString()", unless = "#result == null")
    @Transactional(readOnly = true)
    public UserProfileResponse getProfile(UUID userId, JwtClaims caller) {
        roleManager.assertCanReadProfile(caller, userId);

        UserProfile profile = userRepository.findById(userId)
            .orElseThrow(() -> new ProfileNotFoundException(userId.toString()));

        return toResponse(profile);
    }

    // ── UPDATE PROFILE ──────────────────────────────────────────────────────

    @Override
    @CacheEvict(value = "profiles", key = "#userId.toString()")
    @Transactional
    public UserProfileResponse updateProfile(
        UUID userId, UpdateProfileRequest request, JwtClaims caller
    ) {
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
                Map.of(
                    "userId",  userId.toString(),
                    "email",   profile.getEmail(),
                    "name",    profile.getName(),
                    "surname", profile.getSurname()
                )
            ));
        }

        log.info("[SERVICE] Profil mis à jour | userId={}", userId);
        return toResponse(profile);
    }

    // ── UPDATE PHOTO ────────────────────────────────────────────────────────

    @Override
    @CacheEvict(value = "profiles", key = "#userId.toString()")
    @Transactional
    public UserProfileResponse updatePhoto(
        UUID userId, UpdatePhotoRequest request, JwtClaims caller
    ) {
        roleManager.assertCanUpdateProfile(caller, userId);

        UserProfile profile = userRepository.findById(userId)
            .orElseThrow(() -> new ProfileNotFoundException(userId.toString()));

        String oldPhoto = profile.getPhotoProfil();
        String newPhoto = request.getPhotoProfil();

        if (newPhoto != null && !newPhoto.equals(oldPhoto)) {
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

    // ── DELETE PROFILE ──────────────────────────────────────────────────────

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
            Map.of("userId", userId.toString(), "email", profile.getEmail())
        ));

        log.info("[SERVICE] Profil supprimé | userId={} par admin={}", userId, caller.getUserId());
    }

    // ── LIST USERS ──────────────────────────────────────────────────────────

    @Override
    @Cacheable(value = "userLists", key = "'all'")
    @Transactional(readOnly = true)
    public List<UserProfileResponse> listUsers(JwtClaims caller) {
        roleManager.assertCanListUsers(caller);
        return userRepository.findAll().stream().map(this::toResponse).toList();
    }

    // ── CREATE STAFF (MODIFIÉ) ──────────────────────────────────────────────

    /**
     * Création d'un compte staff (ManagerGlobal, ManagerLocal, Guichetier, Chauffeur)
     * 
     * Nouveau flux :
     * 1. Vérification des droits (Manager ou Admin)
     * 2. Vérification email unique
     * 3. Génération de l'UUID
     * 4. Validation de l'existence de l'agence et/ou filiale
     * 5. Sauvegarde IMMÉDIATE en base
     * 6. Publication d'un événement vers auth-service avec mot de passe "0000"
     * 7. Notification des observateurs internes
     * 8. Invalidation du cache
     */
    @Override
    @Transactional
    public void createStaff(CreateStaffRequest request, JwtClaims caller) {
        // 1. Vérification des droits
        roleManager.assertCanCreateStaff(caller);
        
        // 2. Vérification email unique
        String email = request.getEmail().toLowerCase().strip();
        if (userRepository.existsByEmail(email)) {
            throw new EmailAlreadyExistsException(email);
        }
        
        // 3. Génération de l'UUID (le user-service maîtrise l'identifiant)
        UUID newUserId = UUID.randomUUID();
        
        // 4. Validation des entités externes (Agence/Filiale)
        validateAgenceAndFiliale(request);
        
        // 5. Création et sauvegarde du profil en BASE (immédiat)
        UserProfile profile = buildUserProfile(newUserId, request);
        userRepository.save(profile);
        
        // 6. Publication de l'événement vers AUTH-SERVICE avec mot de passe "0000"
        publishStaffToAuth(newUserId, request);
        
        // 7. Notification des observateurs internes
        notifyObservers(UserEvent.of(
            UserEventType.COMPTE_CREE,
            caller.getUserId(),
            newUserId,
            Map.of(
                "role", request.getRole().name(),
                "email", email
            )
        ));
        
        // 8. Invalidation du cache des listes
        evictUserLists();
        
        log.info("[SERVICE] Staff créé en base | userId={} role={} email={} crééPar={} mdpTemporaire=0000", 
                 newUserId, request.getRole(), email, caller.getUserId());
    }

    /**
     * Valide que l'agence et la filiale référencées existent bien en base.
     * Ces entités sont synchronisées via les événements du fleet-management-service.
     */
    private void validateAgenceAndFiliale(CreateStaffRequest request) {
        // Validation de l'agence (si fournie)
        if (request.getAgenceId() != null && !request.getAgenceId().isBlank()) {
            try {
                UUID agenceId = UUID.fromString(request.getAgenceId());
                if (!agenceRepository.existsByIdAgence(agenceId)) {
                    throw new AgenceNotFoundException(request.getAgenceId());
                }
                log.debug("[SERVICE] Agence validée : {}", agenceId);
            } catch (IllegalArgumentException e) {
                throw new AgenceNotFoundException("Format UUID invalide : " + request.getAgenceId());
            }
        }
        
        // Validation de la filiale (si fournie)
        if (request.getFilialeId() != null && !request.getFilialeId().isBlank()) {
            try {
                UUID filialeId = UUID.fromString(request.getFilialeId());
                if (!filialeRepository.existsByIdFiliale(filialeId)) {
                    throw new FilialeNotFoundException(request.getFilialeId());
                }
                log.debug("[SERVICE] Filiale validée : {}", filialeId);
            } catch (IllegalArgumentException e) {
                throw new FilialeNotFoundException("Format UUID invalide : " + request.getFilialeId());
            }
        }
    }

    /**
     * Construit l'entité UserProfile à partir de la requête.
     * Les champs spécifiques à chaque rôle sont initialisés.
     */
    private UserProfile buildUserProfile(UUID userId, CreateStaffRequest request) {
        UserProfile.UserProfileBuilder builder = UserProfile.builder()
            .idUser(userId)
            .email(request.getEmail().toLowerCase().strip())
            .name(request.getName().strip())
            .surname(request.getSurname().strip())
            .phone(request.getPhone())
            .role(request.getRole())
            .isActive(true);
        
        // Champs optionnels communs
        if (request.getFilialeId() != null && !request.getFilialeId().isBlank()) {
            builder.filialeId(UUID.fromString(request.getFilialeId()));
        }
        if (request.getAgenceId() != null && !request.getAgenceId().isBlank()) {
            builder.agenceId(UUID.fromString(request.getAgenceId()));
        }
        
        // Champs spécifiques selon le rôle
        switch (request.getRole()) {
            case GUICHETIER:
                if (request.getPoste() != null) {
                    builder.poste(request.getPoste());
                }
                break;
                
            case CHAUFFEUR:
                if (request.getNumeroPermis() != null) {
                    builder.numeroPermis(request.getNumeroPermis());
                }
                if (request.getDateEmbauche() != null) {
                    try {
                        builder.dateEmbauche(LocalDateTime.parse(request.getDateEmbauche(), DATE_FORMATTER));
                    } catch (Exception e) {
                        log.warn("[SERVICE] Format date embauche invalide, utilisation null");
                    }
                }
                builder.disponible(true);
                break;
                
            case MANAGER_GLOBAL:
                // Le manager global est associé à une agence (celle qu'il gère)
                if (request.getAgenceId() != null && !request.getAgenceId().isBlank()) {
                    builder.idAgenceManager(UUID.fromString(request.getAgenceId()));
                }
                break;
                
            case MANAGER_LOCAL:
                // Le manager local a juste une filiale et une agence parente
                // Pas de champ spécifique supplémentaire
                break;
                
            default:
                log.warn("[SERVICE] Rôle non géré pour buildUserProfile : {}", request.getRole());
        }
        
        return builder.build();
    }

    /**
     * Publie un événement vers auth-service pour créer le compte authentifiable.
     * Le auth-service est responsable de :
     * - Créer NjilaUser avec le même UUID
     * - Hasher le mot de passe temporaire "0000"
     * - Envoyer un email de bienvenue avec le mot de passe "0000"
     * 
     * Le mot de passe temporaire est fixé à "0000" car celui qui crée le compte
     * n'est pas celui qui utilisera le compte. L'utilisateur final devra modifier
     * son mot de passe lors de sa première connexion.
     */
    private void publishStaffToAuth(UUID userId, CreateStaffRequest request) {
        // Mot de passe temporaire fixe "0000"
        String temporaryPassword = "0000";
        
        Map<String, Object> payload = new HashMap<>();
        payload.put("userId",        userId.toString());
        payload.put("email",         request.getEmail().toLowerCase().strip());
        payload.put("passwordTemp",  temporaryPassword);
        payload.put("role",          request.getRole().name());
        payload.put("name",          request.getName());
        payload.put("surname",       request.getSurname());
        payload.put("phone",         request.getPhone());
        payload.put("filialeId",     request.getFilialeId() != null ? request.getFilialeId() : "");
        payload.put("agenceId",      request.getAgenceId() != null ? request.getAgenceId() : "");
        
        // Champs spécifiques pour le auth-service (optionnels)
        if (request.getPoste() != null) {
            payload.put("poste", request.getPoste());
        }
        if (request.getNumeroPermis() != null) {
            payload.put("numeroPermis", request.getNumeroPermis());
        }
        
        try {
            rabbitTemplate.convertAndSend(
                RabbitMQConfig.EXCHANGE_USER,
                RabbitMQConfig.KEY_STAFF_TO_AUTH,
                payload
            );
            log.info("[SERVICE] Événement staff.to.auth publié | userId={} role={} mdpTemporaire={}", 
                     userId, request.getRole(), temporaryPassword);
        } catch (Exception e) {
            log.error("[SERVICE] Erreur publication staff.to.auth pour userId={} : {}", 
                      userId, e.getMessage());
            // La base est déjà sauvegardée, on log l'erreur
            // Idéalement : stocker dans une table outbox pour retry
        }
    }

    /**
     * Invalide le cache des listes d'utilisateurs.
     */
    private void evictUserLists() {
        var cache = cacheManager.getCache("userLists");
        if (cache != null) {
            cache.clear();
            log.debug("[SERVICE] Cache userLists invalidé");
        }
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
            userId.toString(),
            request.getAgenceId(),
            request.getAgenceNom(),
            request.getNote(),
            request.getCommentaire()
        );

        log.info("[SERVICE] Avis soumis | userId={} agenceId={} note={}", userId, agenceId, request.getNote());
        return toAvisResponse(avis, auteur);
    }

    @Override
    @Transactional(readOnly = true)
    public List<AvisResponse> getUserAvis(UUID userId, JwtClaims caller) {
        roleManager.assertCanReadProfile(caller, userId);

        UserProfile auteur = userRepository.findById(userId)
            .orElseThrow(() -> new ProfileNotFoundException(userId.toString()));

        return avisRepository.findAllByAuteurIdUser(userId)
            .stream().map(a -> toAvisResponse(a, auteur)).toList();
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

    // ── Mappers ─────────────────────────────────────────────────────────────

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
            .filialeId(p.getFilialeId())
            .agenceId(p.getAgenceId())
            .isActive(p.isActive())
            .dateInscription(p.getDateInscription())
            .derniereConnexion(p.getDerniereConnexion())
            .historiqueResa(p.getHistoriqueResa())
            .poste(p.getPoste())
            .numeroPermis(p.getNumeroPermis())
            .idVoyageActuel(p.getIdVoyageActuel())
            .disponible(p.getDisponible())
            .dateEmbauche(p.getDateEmbauche())
            .niveauAcces(p.getNiveauAcces())
            .idAgenceManager(p.getIdAgenceManager())
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