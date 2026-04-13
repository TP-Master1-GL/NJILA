package com.njila.njila_payement_service.application.services.implementations;

import com.njila.njila_payement_service.application.services.interfaces.IdempotencyService;
import com.njila.njila_payement_service.domain.exceptions.InvalidIdempotencyKeyException;
import com.njila.njila_payement_service.domain.valueObjects.IdempotencyKey;
import lombok.RequiredArgsConstructor;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.util.concurrent.TimeUnit;


@Service
@RequiredArgsConstructor(onConstructor_ = @Autowired)


public class IdempotencyServiceImpl implements IdempotencyService {

    private final StringRedisTemplate redisTemplate;

    @Value("${idempotency.ttl}")
    private long ttl;

    @Override
    public boolean exists(IdempotencyKey key) {

        //hasKey is a predefined method which helps to check if a key exists
        return redisTemplate.hasKey(key.getValue());
    }

    @Override
    public boolean checkAndStore(IdempotencyKey key) {

        if(key == null || key.getValue().isBlank()) {
            throw new InvalidIdempotencyKeyException("The key is invalid");
        }

        Boolean isNew = redisTemplate
                .opsForValue()
                .setIfAbsent(
                        key.getValue(),
                        "1",
                        ttl,
                        TimeUnit.SECONDS
                );

        return Boolean.TRUE.equals(isNew);
    }
}
