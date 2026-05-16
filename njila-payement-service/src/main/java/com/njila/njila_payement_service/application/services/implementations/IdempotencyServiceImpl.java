package com.njila.njila_payement_service.application.services.implementations;

import com.njila.njila_payement_service.application.services.interfaces.IdempotencyService;
import com.njila.njila_payement_service.domain.exceptions.InvalidIdempotencyKeyException;
import com.njila.njila_payement_service.domain.valueObjects.IdempotencyKey;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.util.concurrent.TimeUnit;

@Service
@RequiredArgsConstructor(onConstructor_ = @Autowired)
@Slf4j
public class IdempotencyServiceImpl implements IdempotencyService {

    private final StringRedisTemplate redisTemplate;

    @Value("${idempotency.ttl}")
    private long ttl;

    @Override
    public boolean exists(IdempotencyKey key) {
        try {
            return Boolean.TRUE.equals(redisTemplate.hasKey(key.getValue()));
        } catch (Exception e) {
            log.warn("[IDEMPOTENCY] Redis indisponible — exists() clé={} : {}",
                    key.getValue(), e.getMessage());
            return false;
        }
    }

    @Override
    public boolean checkAndStore(IdempotencyKey key) {
        if (key == null || key.getValue().isBlank()) {
            throw new InvalidIdempotencyKeyException("The key is invalid");
        }
        try {
            Boolean isNew = redisTemplate
                    .opsForValue()
                    .setIfAbsent(
                            key.getValue(),
                            "1",
                            ttl,
                            TimeUnit.SECONDS
                    );
            return Boolean.TRUE.equals(isNew);
        } catch (Exception e) {
            // Fallback : Redis down → on autorise le traitement (true = clé nouvelle)
            log.warn("[IDEMPOTENCY] Redis indisponible — checkAndStore() clé={} : {}. " +
                     "Traitement autorisé par défaut.", key.getValue(), e.getMessage());
            return true;
        }
    }
}
