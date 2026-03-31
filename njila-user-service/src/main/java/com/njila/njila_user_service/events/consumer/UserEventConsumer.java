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
 * UserEventConsumer — consommateur RabbitMQ du user-service.
 *
 * Queues écoutées :
 * ┌──────────────────────────────────────┬─────────────────────┬────────────────────┐
 * │ Queue                                │ Exchange            │ Routing key        │
 * ├──────────────────────────────────────┼─────────────────────┼────────────────────┤
 * │ njila.user.registered.queue          │ njila.user.exchange │ user.registered    │
 * │ njila.user.updated.queue             │ njila.user.exchange │ user.updated       │
 * │ njila.user.staff-created.queue       │ njila.user.exchange │ staff.created      │
 * └──────────────────────────────────────┴─────────────────────┴────────────────────┘
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class UserEventConsumer {

    private final UserRepository userRepository;
    private final CacheManager   cacheManager;

    // ── user.registered ────────────────────────────────────────────────────

    @RabbitListener(queues = "njila.user.registered.queue")
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

            log.info("[CONSUMER] Profil créé | userId={} role={}", userId, role);

        } catch (Exception e) {
            log.error("[CONSUMER] Erreur user.registered : {}", e.getMessage(), e);
        }
    }

    // ── user.updated ────────────────────────────────────────────────────────

    @RabbitListener(queues = "njila.user.updated.queue")
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

    // ── staff.created ───────────────────────────────────────────────────────

    @RabbitListener(queues = "njila.user.staff-created.queue")
    public void handleStaffCreated(Map<String, Object> payload) {
        log.info("[CONSUMER] staff.created reçu");
        try {
            String userId     = getString(payload, "userId");
            String email      = getString(payload, "email");
            String roleStr    = getString(payload, "role");
            String name       = getString(payload, "name");
            String surname    = getString(payload, "surname");
            String phone      = getString(payload, "phone");
            String photoUrl   = getString(payload, "photoUrl");
            String filialeStr = getString(payload, "filialeId");
            String agenceStr  = getString(payload, "agenceId");

            if (userId == null || email == null) {
                log.error("[CONSUMER] staff.created : userId ou email manquant");
                return;
            }

            UUID id = UUID.fromString(userId);

            if (userRepository.existsById(id)) {
                log.warn("[CONSUMER] Profil staff déjà existant userId={} — ignoré", userId);
                return;
            }

            Role role = parseRole(roleStr, Role.GUICHETIER);

            UserProfile profile = UserProfile.builder()
                .idUser(id)
                .email(email.toLowerCase().strip())
                .name(name    != null ? name    : "")
                .surname(surname != null ? surname : "")
                .phone(phone)
                .photoProfil(photoUrl)
                .role(role)
                .filialeId(filialeStr != null ? UUID.fromString(filialeStr) : null)
                .agenceId(agenceStr   != null ? UUID.fromString(agenceStr)  : null)
                .isActive(true)
                .build();

            userRepository.save(profile);
            invalidateLists();

            log.info("[CONSUMER] Profil staff créé | userId={} role={}", userId, role);

        } catch (Exception e) {
            log.error("[CONSUMER] Erreur staff.created : {}", e.getMessage(), e);
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