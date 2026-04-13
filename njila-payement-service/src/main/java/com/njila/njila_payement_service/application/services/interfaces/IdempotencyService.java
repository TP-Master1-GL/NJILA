package com.njila.njila_payement_service.application.services.interfaces;

import com.njila.njila_payement_service.domain.valueObjects.IdempotencyKey;

public interface IdempotencyService {

    boolean exists(IdempotencyKey key);

    boolean checkAndStore(IdempotencyKey key);
}
