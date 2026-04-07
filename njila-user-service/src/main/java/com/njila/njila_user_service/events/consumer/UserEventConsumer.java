package com.njila.njila_user_service.events.consumer;

import com.njila.njila_user_service.entity.UserProfile;
import com.njila.njila_user_service.enums.Role;
import com.njila.njila_user_service.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.cache.CacheManager;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.UUID;

/**
 * UserEventConsumer — consommateur RabbitMQ du user-service v2.0.
 * 
 * CORRECTION : Les noms des queues ont été modifiés pour correspondre
 * à ce que l'auth-service publie.
 *
 * Queues écoutées :
 * ┌──────────────────────────────────────────────────┬─────────────────────┬────────────────────────┐
 * │ Queue                                            │ Exchange            │ Routing key            │
 * ├──────────────────────────────────────────────────┼─────────────────────┼────────────────────────┤
 * │ njila.auth.user.registered.queue                 │ njila.user.exchange │ user.registered        │
 * │ njila.auth.user.updated.queue                    │ njila.user.exchange │ user.updated           │
 * │ njila.user.agence-created.queue                  │ njila.fleet.exchange│ agence.created         │
 * │ njila.user.filiale-created.queue                 │ njila.fleet.exchange│ filiale.created        │
 * │ njila.user.reservation-created.queue             │ njila.booking.exchange│ reservation.created   │
 * └──────────────────────────────────────────────────┴─────────────────────┴────────────────────────┘
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class UserEventConsumer {

    private final UserRepository userRepository;
    private final CacheManager   cacheManager;

    // ── user.registered (Voyageur) ─────────────────────────────────────────
    // CORRECTION : Queue modifiée pour correspondre à ce que l'auth-service publie
    @RabbitListener(queues = "njila.auth.user.registered.queue")
    public void handleUserRegistered(Map<String, Object> payload) {
        log.info("[CONSUMER] user.registered reçu");
        try {
            String userId  = getString(payload, "userId");
            String email   = getString(payload, "email");
            String name    = getString(payload, "name");
            String surname = getString(payload, "surname");
            String roleStr = getString(payload, "role");

            if (userId == null || email == null) {
                log.error("[CONSUMER] user.registered : userId ou email manquant");
                return;
            }

            UUID id = UUID.fromString(userId);

            // Idempotence
            if (userRepository.existsById(id)) {
                log.warn("[CONSUMER] Profil déjà existant userId={} — ignoré", userId);
                return;
            }

            Role role = parseRole(roleStr, Role.VOYAGEUR);

            UserProfile profile = UserProfile.builder()
                .idUser(id)
                .email(email.toLowerCase().strip())
                .name(name    != null ? name    : "")
                .surname(surname != null ? surname : "")
                .phone(getString(payload, "phone"))
                .adresse(getString(payload, "adresse"))
                .photoProfil(getString(payload, "photoUrl"))
                .role(role)
                .filialeId(getUuid(payload, "filialeId"))
                .agenceId(getUuid(payload, "agenceId"))
                .isActive(true)
                .build();

            userRepository.save(profile);
            invalidateLists();

            log.info("[CONSUMER] Profil voyageur créé | userId={} role={}", userId, role);

        } catch (Exception e) {
            log.error("[CONSUMER] Erreur user.registered : {}", e.getMessage(), e);
        }
    }

    // ── user.updated ────────────────────────────────────────────────────────
    // CORRECTION : Queue modifiée pour correspondre à ce que l'auth-service publie
    @RabbitListener(queues = "njila.auth.user.updated.queue")
    public void handleUserUpdated(Map<String, Object> payload) {
        log.debug("[CONSUMER] user.updated reçu");
        try {
            String userId       = getString(payload, "userId");
            String photoUrl     = getString(payload, "photoUrl");
            boolean emailChanged = Boolean.TRUE.equals(payload.get("emailChanged"));
            String email         = getString(payload, "email");

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

    // ── agence.created ──────────────────────────────────────────────────────

    @RabbitListener(queues = "njila.user.agence-created.queue")
    public void handleAgenceCreated(Map<String, Object> payload) {
        log.info("[CONSUMER] agence.created reçu");
        try {
            // TODO: Implémenter la création de l'entité Agence
            // Cette méthode est appelée par le fleet-management-service
            log.debug("[CONSUMER] Payload agence: {}", payload);
        } catch (Exception e) {
            log.error("[CONSUMER] Erreur agence.created : {}", e.getMessage(), e);
        }
    }

    // ── filiale.created ─────────────────────────────────────────────────────

    @RabbitListener(queues = "njila.user.filiale-created.queue")
    public void handleFilialeCreated(Map<String, Object> payload) {
        log.info("[CONSUMER] filiale.created reçu");
        try {
            // TODO: Implémenter la création de l'entité Filiale
            log.debug("[CONSUMER] Payload filiale: {}", payload);
        } catch (Exception e) {
            log.error("[CONSUMER] Erreur filiale.created : {}", e.getMessage(), e);
        }
    }

    // ── reservation.created ─────────────────────────────────────────────────

    @RabbitListener(queues = "njila.user.reservation-created.queue")
    public void handleReservationCreated(Map<String, Object> payload) {
        log.debug("[CONSUMER] reservation.created reçu");
        try {
            // TODO: Implémenter la mise à jour de l'historique des réservations
            log.debug("[CONSUMER] Payload réservation: {}", payload);
        } catch (Exception e) {
            log.error("[CONSUMER] Erreur reservation.created : {}", e.getMessage(), e);
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
        var cache = cacheManager.getCache("profiles");
        if (cache != null) cache.evict(userId);
    }

    private void invalidateLists() {
        var cache = cacheManager.getCache("userLists");
        if (cache != null) cache.clear();
    }
}