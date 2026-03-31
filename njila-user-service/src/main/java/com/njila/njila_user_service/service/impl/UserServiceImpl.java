package com.njila.njila_user_service.service.impl;

import com.njila.njila_user_service.dto.request.AvisRequest;
import com.njila.njila_user_service.dto.request.CreateStaffRequest;
import com.njila.njila_user_service.dto.request.UpdateProfileRequest;
import com.njila.njila_user_service.dto.response.AvisResponse;
import com.njila.njila_user_service.dto.response.UserProfileResponse;
import com.njila.njila_user_service.entity.Avis;
import com.njila.njila_user_service.entity.UserProfile;
import com.njila.njila_user_service.enums.UserEventType;
import com.njila.njila_user_service.events.publisher.EventPublisher;
import com.njila.njila_user_service.exception.*;
import com.njila.njila_user_service.middleware.JwtClaims;
import com.njila.njila_user_service.observer.IUserObserver;
import com.njila.njila_user_service.observer.IUserSubject;
import com.njila.njila_user_service.observer.UserEvent;
import com.njila.njila_user_service.repository.AvisRepository;
import com.njila.njila_user_service.repository.UserRepository;
import com.njila.njila_user_service.service.RedisCacheInvalidator;
import com.njila.njila_user_service.service.RoleManager;
import com.njila.njila_user_service.service.UserService;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

/**
 * UserServiceImpl — logique métier complète.
 * Implémente IUserSubject (pattern Observer du diagramme UML).
 *
 * Cache Redis (TTL défini dans RedisCacheConfig) :
 *   "profiles"   → clé = userId, TTL 10 min
 *   "userLists"  → toutes les listes, TTL 5 min
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class UserServiceImpl implements UserService, IUserSubject {

    private final UserRepository      userRepository;
    private final AvisRepository      avisRepository;
    private final RoleManager         roleManager;
    private final EventPublisher      eventPublisher;
    private final RedisCacheInvalidator cacheInvalidator;
    private final RabbitTemplate      rabbitTemplate;

    private final List<IUserObserver> observers = new ArrayList<>();

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

    /**
     * Diagramme séquence GetProfile :
     * 1. Vérifier JWT + autorisation
     * 2. Check cache Redis → retourner si HIT
     * 3. SELECT profile en base → 404 si absent
     * 4. SET cache TTL 10 min
     * 5. Retourner JSON
     */
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

    // ── DELETE PROFILE ──────────────────────────────────────────────────────

    /**
     * Diagramme séquence DeleteProfile :
     * Admin uniquement. 204 No Content en cas de succès.
     */
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

    // ── CREATE STAFF ────────────────────────────────────────────────────────

    /**
     * Diagramme activité creer_compte_staff :
     * 1. Vérifier token Manager
     * 2. Vérifier email (→ 409 si existant)
     * 3. Publier staff.created sur njila.user.exchange
     * 4. Retourner 201 (création profil asynchrone via consumer)
     */
    @Override
    @Transactional
    public void createStaff(CreateStaffRequest request, JwtClaims caller) {
        roleManager.assertCanCreateStaff(caller);

        String email = request.getEmail().toLowerCase().strip();

        if (userRepository.existsByEmail(email)) {
            throw new EmailAlreadyExistsException(email);
        }

        Map<String, Object> payload = new HashMap<>();
        payload.put("email",        email);
        payload.put("name",         request.getName());
        payload.put("surname",      request.getSurname());
        payload.put("phone",        request.getPhone());
        payload.put("role",         request.getRole().name());
        payload.put("filialeId",    request.getFilialeId());
        payload.put("agenceId",     request.getAgenceId());
        payload.put("poste",        request.getPoste());
        payload.put("numeroPermis", request.getNumeroPermis());
        payload.put("passwordTemp", "NjilaChange2026!");

        try {
            rabbitTemplate.convertAndSend("njila.user.exchange", "staff.created", payload);
            log.info("[SERVICE] staff.created publié | email={} role={}", email, request.getRole());
        } catch (Exception e) {
            log.error("[SERVICE] Erreur publication staff.created : {}", e.getMessage());
            throw new RuntimeException("Erreur lors de la création du compte staff.");
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