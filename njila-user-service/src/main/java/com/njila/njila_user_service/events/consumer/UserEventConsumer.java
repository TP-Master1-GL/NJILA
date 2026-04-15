package com.njila.njila_user_service.events.consumer;

import com.njila.njila_user_service.entity.*;
import com.njila.njila_user_service.enums.Role;
import com.njila.njila_user_service.repository.AgenceRepository;
import com.njila.njila_user_service.repository.FilialeRepository;
import com.njila.njila_user_service.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.cache.CacheManager;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

@Component
@RequiredArgsConstructor
@Slf4j
public class UserEventConsumer {

    private final UserRepository userRepository;
    private final AgenceRepository agenceRepository;
    private final FilialeRepository filialeRepository;
    private final CacheManager cacheManager;

    @RabbitListener(queues = {"njila.user.registered.queue", "njila.auth.user.registered.queue"})
    public void handleUserRegistered(Map<String, Object> payload) {
        log.info("[CONSUMER] user.registered reçu");
        try {
            String userId = getString(payload, "userId");
            String email = getString(payload, "email");
            String name = getString(payload, "name");
            String surname = getString(payload, "surname");
            String roleStr = getString(payload, "role");
            String phone = getString(payload, "phone");
            String adresse = getString(payload, "adresse");
            String photoUrl = getString(payload, "photoUrl");
            String filialeIdStr = getString(payload, "filialeId");
            String agenceIdStr = getString(payload, "agenceId");

            if (userId == null || email == null) {
                log.error("[CONSUMER] user.registered : userId ou email manquant");
                return;
            }

            UUID id = UUID.fromString(userId);
            UUID filialeId = filialeIdStr != null ? UUID.fromString(filialeIdStr) : null;
            UUID agenceId = agenceIdStr != null ? UUID.fromString(agenceIdStr) : null;

            if (userRepository.existsById(id)) {
                log.warn("[CONSUMER] Profil déjà existant userId={} — ignoré", userId);
                return;
            }

            Role role = parseRole(roleStr, Role.VOYAGEUR);
            UserProfile profile;

            // Créer le bon type d'entité selon le rôle
            switch (role) {
                case ADMINISTRATEUR:
                    profile = new Administrateur(
                        id, 
                        name != null ? name : "", 
                        surname != null ? surname : "",
                        email.toLowerCase().strip(), 
                        phone, 
                        adresse, 
                        photoUrl,
                        true, 
                        LocalDateTime.now(), 
                        null, 
                        null
                    );
                    break;
                    
                case MANAGER_GLOBAL:
                    if (agenceId == null) {
                        log.error("[CONSUMER] MANAGER_GLOBAL sans agenceId");
                        return;
                    }
                    profile = ManagerGlobal.builder()
                        .idUser(id)
                        .name(name != null ? name : "")
                        .surname(surname != null ? surname : "")
                        .email(email.toLowerCase().strip())
                        .phone(phone)
                        .adresse(adresse)
                        .photoProfil(photoUrl)
                        .agenceId(agenceId)
                        .isActive(true)
                        .build();
                    break;
                    
                case MANAGER_LOCAL:
                    if (agenceId == null || filialeId == null) {
                        log.error("[CONSUMER] MANAGER_LOCAL sans agenceId ou filialeId");
                        return;
                    }
                    profile = ManagerLocal.builder()
                        .idUser(id)
                        .name(name != null ? name : "")
                        .surname(surname != null ? surname : "")
                        .email(email.toLowerCase().strip())
                        .phone(phone)
                        .adresse(adresse)
                        .photoProfil(photoUrl)
                        .agenceId(agenceId)
                        .filialeId(filialeId)
                        .isActive(true)
                        .build();
                    break;
                    
                case GUICHETIER:
                    if (agenceId == null || filialeId == null) {
                        log.error("[CONSUMER] GUICHETIER sans agenceId ou filialeId");
                        return;
                    }
                    profile = Guichetier.builder()
                        .idUser(id)
                        .name(name != null ? name : "")
                        .surname(surname != null ? surname : "")
                        .email(email.toLowerCase().strip())
                        .phone(phone)
                        .adresse(adresse)
                        .photoProfil(photoUrl)
                        .agenceId(agenceId)
                        .filialeId(filialeId)
                        .isActive(true)
                        .build();
                    break;
                    
                case CHAUFFEUR:
                    if (agenceId == null || filialeId == null) {
                        log.error("[CONSUMER] CHAUFFEUR sans agenceId ou filialeId");
                        return;
                    }
                    profile = Chauffeur.builder()
                        .idUser(id)
                        .name(name != null ? name : "")
                        .surname(surname != null ? surname : "")
                        .email(email.toLowerCase().strip())
                        .phone(phone)
                        .adresse(adresse)
                        .photoProfil(photoUrl)
                        .agenceId(agenceId)
                        .filialeId(filialeId)
                        .disponible(true)
                        .isActive(true)
                        .build();
                    break;
                    
                default: // VOYAGEUR
                    profile = new Voyageur(
                        id, 
                        name != null ? name : "", 
                        surname != null ? surname : "",
                        email.toLowerCase().strip(), 
                        phone, 
                        adresse, 
                        photoUrl,
                        true, 
                        LocalDateTime.now(), 
                        null, 
                        null, 
                        null
                    );
                    break;
            }

            userRepository.save(profile);
            invalidateLists();

            log.info("[CONSUMER] Profil créé | userId={} role={} userType={}", 
                     userId, role, profile.getClass().getSimpleName());

        } catch (Exception e) {
            log.error("[CONSUMER] Erreur user.registered : {}", e.getMessage(), e);
        }
    }

    @RabbitListener(queues = {"njila.user.updated.queue", "njila.auth.user.updated.queue"})
    public void handleUserUpdated(Map<String, Object> payload) {
        log.debug("[CONSUMER] user.updated reçu");
        try {
            String userId = getString(payload, "userId");
            String photoUrl = getString(payload, "photoUrl");
            boolean emailChanged = Boolean.TRUE.equals(payload.get("emailChanged"));
            String email = getString(payload, "email");

            if (userId == null) return;

            userRepository.findById(UUID.fromString(userId)).ifPresent(profile -> {
                boolean changed = false;

                if (photoUrl != null && !photoUrl.equals(profile.getPhotoProfil())) {
                    profile.setPhotoProfil(photoUrl);
                    changed = true;
                }
                if (emailChanged && email != null) {
                    profile.setEmail(email.toLowerCase().strip());
                    changed = true;
                }
                if (changed) {
                    userRepository.save(profile);
                    evictProfile(userId);
                    log.info("[CONSUMER] Profil mis à jour | userId={}", userId);
                }
            });

        } catch (Exception e) {
            log.error("[CONSUMER] Erreur user.updated : {}", e.getMessage(), e);
        }
    }

    @RabbitListener(queues = "njila.user.agence-created.queue")
    @Transactional
    public void handleAgenceCreated(Map<String, Object> payload) {
        log.info("[CONSUMER] agence.created reçu - payload: {}", payload);
        try {
            // ✅ Adapter aux noms de champs envoyés par fleet-service (snake_case)
            String agenceId = getString(payload, "agence_id");      // snake_case
            String nom = getString(payload, "nom");
            String adresse = getString(payload, "adresse");
            String telephone = getString(payload, "telephone");
            String emailOfficiel = getString(payload, "email_officiel");

            if (agenceId == null || nom == null) {
                log.error("[CONSUMER] agence.created : agence_id ou nom manquant");
                return;
            }

            UUID id = UUID.fromString(agenceId);

            if (agenceRepository.existsById(id)) {
                log.warn("[CONSUMER] Agence déjà existante id={} — ignoré", agenceId);
                return;
            }

            // Construire la description à partir des données disponibles
            StringBuilder description = new StringBuilder();
            if (adresse != null && !adresse.isBlank()) {
                description.append("Adresse: ").append(adresse).append(". ");
            }
            if (telephone != null && !telephone.isBlank()) {
                description.append("Tél: ").append(telephone).append(". ");
            }
            if (emailOfficiel != null && !emailOfficiel.isBlank()) {
                description.append("Email: ").append(emailOfficiel);
            }

            Agence agence = Agence.builder()
                .idAgence(id)
                .nom(nom)
                .description(description.toString())
                .adresse(adresse)
                .telephone(telephone)
                .emailOfficiel(emailOfficiel)
                .isActive(true)
                .build();

            agenceRepository.save(agence);
            log.info("[CONSUMER] Agence créée | id={} nom={} adresse={} tel={} email={}", 
                     agenceId, nom, adresse, telephone, emailOfficiel);

        } catch (Exception e) {
            log.error("[CONSUMER] Erreur agence.created : {}", e.getMessage(), e);
        }
    }

    @RabbitListener(queues = "njila.user.agence-updated.queue")
    @Transactional
    public void handleAgenceUpdated(Map<String, Object> payload) {
        log.info("[CONSUMER] agence.updated reçu - payload: {}", payload);
        try {
            // ✅ Adapter aux noms de champs envoyés par fleet-service (snake_case)
            String agenceId = getString(payload, "agence_id");
            String nom = getString(payload, "nom");
            String telephone = getString(payload, "telephone");
            String emailOfficiel = getString(payload, "email_officiel");
            String statutGlobal = getString(payload, "statut_global");

            if (agenceId == null) {
                log.error("[CONSUMER] agence.updated : agence_id manquant");
                return;
            }

            UUID id = UUID.fromString(agenceId);
            Agence agence = agenceRepository.findById(id).orElse(null);

            if (agence == null) {
                log.warn("[CONSUMER] Agence non trouvée pour mise à jour id={}", agenceId);
                return;
            }

            boolean changed = false;

            if (nom != null && !nom.isBlank()) {
                agence.setNom(nom);
                changed = true;
            }
            if (telephone != null && !telephone.isBlank()) {
                agence.setTelephone(telephone);
                changed = true;
            }
            if (emailOfficiel != null && !emailOfficiel.isBlank()) {
                agence.setEmailOfficiel(emailOfficiel);
                changed = true;
            }
            if (statutGlobal != null) {
                // Mettre à jour le statut si nécessaire
                // agence.setStatutGlobal(statutGlobal);
                changed = true;
            }

            if (changed) {
                // Mettre à jour la description
                StringBuilder description = new StringBuilder();
                if (agence.getAdresse() != null && !agence.getAdresse().isBlank()) {
                    description.append("Adresse: ").append(agence.getAdresse()).append(". ");
                }
                if (agence.getTelephone() != null && !agence.getTelephone().isBlank()) {
                    description.append("Tél: ").append(agence.getTelephone()).append(". ");
                }
                if (agence.getEmailOfficiel() != null && !agence.getEmailOfficiel().isBlank()) {
                    description.append("Email: ").append(agence.getEmailOfficiel());
                }
                agence.setDescription(description.toString());

                agenceRepository.save(agence);
                log.info("[CONSUMER] Agence mise à jour | id={} nom={} tel={} email={}", 
                         agenceId, nom, telephone, emailOfficiel);
            } else {
                log.debug("[CONSUMER] Aucune modification pour l'agence id={}", agenceId);
            }

        } catch (Exception e) {
            log.error("[CONSUMER] Erreur agence.updated : {}", e.getMessage(), e);
        }
    }

    @RabbitListener(queues = "njila.user.filiale-created.queue")
    @Transactional
    public void handleFilialeCreated(Map<String, Object> payload) {
        log.info("[CONSUMER] filiale.created reçu - payload: {}", payload);
        try {
            // ✅ Adapter aux noms de champs envoyés par fleet-service (snake_case)
            String filialeId = getString(payload, "filiale_id");    // snake_case
            String agenceId = getString(payload, "agence_id");      // snake_case
            String nom = getString(payload, "nom");
            String adresse = getString(payload, "adresse");
            String ville = getString(payload, "ville");
            String code = getString(payload, "code");
            String telephone = getString(payload, "telephone");
            String email = getString(payload, "email");

            if (filialeId == null || nom == null) {
                log.error("[CONSUMER] filiale.created : filiale_id ou nom manquant");
                return;
            }
            if (agenceId == null) {
                log.error("[CONSUMER] filiale.created : agence_id manquant");
                return;
            }

            UUID idFiliale = UUID.fromString(filialeId);
            UUID idAgence = UUID.fromString(agenceId);

            if (filialeRepository.existsById(idFiliale)) {
                log.warn("[CONSUMER] Filiale déjà existante id={} — ignoré", filialeId);
                return;
            }

            if (!agenceRepository.existsById(idAgence)) {
                log.error("[CONSUMER] Agence parente inexistante | agenceId={}", agenceId);
                return;
            }

            Filiale filiale = Filiale.builder()
                .idFiliale(idFiliale)
                .nom(nom)
                .adresse(adresse != null ? adresse : "")
                .ville(ville != null ? ville : "")
                .agenceId(idAgence)
                .code(code != null ? code : "")
                .telephone(telephone != null ? telephone : "")
                .email(email != null ? email : "")
                .isActive(true)
                .build();

            filialeRepository.save(filiale);
            log.info("[CONSUMER] Filiale créée | id={} nom={} agenceId={} ville={} code={} tel={} email={}", 
                     filialeId, nom, agenceId, ville, code, telephone, email);

        } catch (Exception e) {
            log.error("[CONSUMER] Erreur filiale.created : {}", e.getMessage(), e);
        }
    }

    @RabbitListener(queues = "njila.user.filiale-updated.queue")
    @Transactional
    public void handleFilialeUpdated(Map<String, Object> payload) {
        log.info("[CONSUMER] filiale.updated reçu - payload: {}", payload);
        try {
            // ✅ Adapter aux noms de champs envoyés par fleet-service (snake_case)
            String filialeId = getString(payload, "filiale_id");
            String agenceId = getString(payload, "agence_id");
            String nom = getString(payload, "nom");
            String code = getString(payload, "code");
            String ville = getString(payload, "ville");
            String telephone = getString(payload, "telephone");
            String email = getString(payload, "email");
            Boolean estActive = payload.get("est_active") instanceof Boolean ? (Boolean) payload.get("est_active") : null;

            if (filialeId == null) {
                log.error("[CONSUMER] filiale.updated : filiale_id manquant");
                return;
            }

            UUID idFiliale = UUID.fromString(filialeId);
            Filiale filiale = filialeRepository.findById(idFiliale).orElse(null);

            if (filiale == null) {
                log.warn("[CONSUMER] Filiale non trouvée pour mise à jour id={}", filialeId);
                return;
            }

            boolean changed = false;

            if (nom != null && !nom.isBlank()) {
                filiale.setNom(nom);
                changed = true;
            }
            if (code != null && !code.isBlank()) {
                filiale.setCode(code);
                changed = true;
            }
            if (ville != null && !ville.isBlank()) {
                filiale.setVille(ville);
                changed = true;
            }
            if (telephone != null && !telephone.isBlank()) {
                filiale.setTelephone(telephone);
                changed = true;
            }
            if (email != null && !email.isBlank()) {
                filiale.setEmail(email);
                changed = true;
            }
            if (estActive != null) {
                filiale.setActive(estActive);
                changed = true;
            }

            if (changed) {
                filialeRepository.save(filiale);
                log.info("[CONSUMER] Filiale mise à jour | id={} nom={} ville={} tel={} email={} active={}", 
                         filialeId, nom, ville, telephone, email, estActive);
            } else {
                log.debug("[CONSUMER] Aucune modification pour la filiale id={}", filialeId);
            }

        } catch (Exception e) {
            log.error("[CONSUMER] Erreur filiale.updated : {}", e.getMessage(), e);
        }
    }

    @RabbitListener(queues = "njila.user.reservation-created.queue")
    public void handleReservationCreated(Map<String, Object> payload) {
        log.info("[CONSUMER] reservation.created reçu");
        try {
            String userId = getString(payload, "userId");
            if (userId != null) {
                userRepository.findById(UUID.fromString(userId)).ifPresent(profile -> {
                    if (profile instanceof Voyageur voyageur) {
                        // Mettre à jour l'historique des réservations
                        String historique = voyageur.getHistoriqueResa();
                        // TODO: Ajouter la nouvelle réservation à l'historique
                        voyageur.setHistoriqueResa(historique);
                        userRepository.save(voyageur);
                        evictProfile(userId);
                        log.info("[CONSUMER] Historique réservation mis à jour | userId={}", userId);
                    }
                });
            }
            log.debug("[CONSUMER] Payload réservation: {}", payload);
        } catch (Exception e) {
            log.error("[CONSUMER] Erreur reservation.created : {}", e.getMessage(), e);
        }
    }

    @RabbitListener(queues = "njila.notification.staff.created.queue")
    public void handleStaffCreated(Map<String, Object> payload) {
        log.info("[CONSUMER] staff.created reçu");
        try {
            String userId = getString(payload, "userId");
            String email = getString(payload, "email");
            String role = getString(payload, "role");
            String agenceId = getString(payload, "agenceId");
            String filialeId = getString(payload, "filialeId");
            String createdBy = getString(payload, "createdBy");

            log.info("[CONSUMER] Staff créé | userId={} role={} agenceId={} filialeId={} par={}",
                     userId, role, agenceId, filialeId, createdBy);

            // Invalider les listes pour que les managers voient le nouveau staff
            invalidateLists();

            // TODO: Envoyer notification email aux managers concernés

        } catch (Exception e) {
            log.error("[CONSUMER] Erreur staff.created : {}", e.getMessage(), e);
        }
    }

    @RabbitListener(queues = "njila.notification.staff.deleted.queue")
    public void handleStaffDeleted(Map<String, Object> payload) {
        log.info("[CONSUMER] staff.deleted reçu");
        try {
            String userId = getString(payload, "userId");
            String email = getString(payload, "email");
            String role = getString(payload, "role");
            String deletedBy = getString(payload, "deletedBy");

            log.info("[CONSUMER] Staff supprimé | userId={} role={} par={}", userId, role, deletedBy);

            evictProfile(userId);
            invalidateLists();

        } catch (Exception e) {
            log.error("[CONSUMER] Erreur staff.deleted : {}", e.getMessage(), e);
        }
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    private String getString(Map<String, Object> map, String key) {
        Object val = map.get(key);
        return val instanceof String s ? s : null;
    }

    private UUID getUuid(Map<String, Object> map, String key) {
        String val = getString(map, key);
        if (val == null || val.isBlank()) return null;
        try { return UUID.fromString(val); } catch (Exception e) { return null; }
    }

    private Role parseRole(String roleStr, Role defaultRole) {
        if (roleStr == null) return defaultRole;
        try { return Role.valueOf(roleStr); } catch (Exception e) { return defaultRole; }
    }

    private void evictProfile(String userId) {
        if (userId == null) return;
        var cache = cacheManager.getCache("profiles");
        if (cache != null) cache.evict(userId);
    }

    private void invalidateLists() {
        var cache = cacheManager.getCache("userLists");
        if (cache != null) cache.clear();
    }
}