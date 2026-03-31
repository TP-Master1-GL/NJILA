package com.njila.njila_user_service.service;

import com.njila.njila_user_service.observer.IUserObserver;
import com.njila.njila_user_service.observer.UserEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.CacheManager;
import org.springframework.stereotype.Component;

/**
 * RedisCacheInvalidator — Observateur du pattern Observer.
 * Invalide le cache Redis en réaction aux événements UserService.
 *
 * Cache "profiles"   → clé = userId (TTL 10 min)
 * Cache "userLists"  → toutes les listes (TTL 5 min)
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class RedisCacheInvalidator implements IUserObserver {

    private final CacheManager cacheManager;

    private static final String CACHE_PROFILES   = "profiles";
    private static final String CACHE_USER_LISTS = "userLists";

    @Override
    public void onUserEvent(UserEvent event) {
        String targetUserId = event.getTargetUserId();

        switch (event.getEventType()) {
            case PROFIL_MODIFIER, PHOTO_MISE_A_JOUR -> {
                evictProfile(targetUserId);
                log.debug("[CACHE] Profil invalidé userId={}", targetUserId);
            }
            case COMPTE_SUPPRIMER -> {
                evictProfile(targetUserId);
                evictLists();
                log.debug("[CACHE] Profil + listes invalidés userId={}", targetUserId);
            }
            case COMPTE_CREE, CHAUFFEUR_DISPO -> {
                evictLists();
                log.debug("[CACHE] Listes invalidées suite à {}", event.getEventType());
            }
        }
    }

    private void evictProfile(String userId) {
        if (userId == null) return;
        var cache = cacheManager.getCache(CACHE_PROFILES);
        if (cache != null) cache.evict(userId);
    }

    private void evictLists() {
        var cache = cacheManager.getCache(CACHE_USER_LISTS);
        if (cache != null) cache.clear();
    }
}