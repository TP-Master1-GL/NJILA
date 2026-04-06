package com.njila.njila_payement_service.domain.valueObjects;


import com.njila.njila_payement_service.domain.exceptions.InvalidIdempotencyKeyException;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter

public class IdempotencyKey {

    private String value;

    private LocalDateTime createdAt;

    //So we can't create an idempotency key anywhere else without the method of().
    private IdempotencyKey() {}

    //Factory Method

    public static IdempotencyKey of(String value) {
        if (value == null || value.isEmpty()) {
            throw new InvalidIdempotencyKeyException("Value cannot be null or empty");
        }

        IdempotencyKey key = new IdempotencyKey();
        key.value = value;
        key.createdAt = LocalDateTime.now();
        return key;
    }


    // Check if the key is well-formed.

    public boolean isValid(){
        return this.value != null && !this.value.isBlank();
    }


    // Check if two keys have the same value.

    public boolean equals(IdempotencyKey other) {

        if (other == null) {
            return false;
        }
        return this.value.equals(other.value);
    }
}
