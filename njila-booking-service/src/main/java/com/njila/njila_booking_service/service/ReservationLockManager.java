package com.njila.njila_booking_service.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;
import java.time.Duration;

@Service
@RequiredArgsConstructor
@Slf4j
public class ReservationLockManager {

    private final RedisTemplate<String, String> redisTemplate;

    // Convention NJILA : njila:booking:lock:{idVoyage}:{idVoyageur}
    private static final String KEY_TEMPLATE  = "njila:booking:lock:%s:%s";
    private static final Duration DUREE_VERROU = Duration.ofMinutes(10);

    public boolean acquerirVerrou(String idVoyage, String idVoyageur, Long bookingId) {
        String cle    = getCleVerrou(idVoyage, idVoyageur);
        Boolean acquis = redisTemplate.opsForValue()
                .setIfAbsent(cle, bookingId.toString(), DUREE_VERROU);
        if (Boolean.TRUE.equals(acquis)) {
            log.info("[LOCK] Verrou acquis : {} → bookingId={}", cle, bookingId);
            return true;
        }
        log.warn("[LOCK] Verrou déjà pris : {}", cle);
        return false;
    }

    public void libererVerrou(String idVoyage, String idVoyageur) {
        String cle = getCleVerrou(idVoyage, idVoyageur);
        redisTemplate.delete(cle);
        log.info("[LOCK] Verrou libéré : {}", cle);
    }

    public boolean verifierVerrou(String idVoyage, String idVoyageur) {
        String cle = getCleVerrou(idVoyage, idVoyageur);
        return Boolean.TRUE.equals(redisTemplate.hasKey(cle));
    }

    public String getCleVerrou(String idVoyage, String idVoyageur) {
        return String.format(KEY_TEMPLATE, idVoyage, idVoyageur);
    }
}