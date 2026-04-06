package com.njila.njila_payement_service.application.services.implementations;

import com.njila.njila_payement_service.application.services.interfaces.IdempotencyService;
import com.njila.njila_payement_service.domain.valueObjects.IdempotencyKey;
import lombok.RequiredArgsConstructor;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.stereotype.Service;


@Service
@RequiredArgsConstructor(onConstructor_ = @Autowired)


public class IdempotencyServiceImpl implements IdempotencyService {

    private final RedisConnectionFactory redisConnectionFactory;

    @Value("${idempotency.ttl}")
    private long ttl;

    @Override
    public boolean exists(IdempotencyKey key) {
        return false;
    }

    @Override
    public boolean checkAndStore(IdempotencyKey key) {
        return false;
    }
}
