package com.njila.njila_payement_service.domain.valueObjects;

import com.njila.njila_payement_service.domain.exceptions.InvalidIdempotencyKeyException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

public class IdempotencyKeyTest {

    @Test
    @DisplayName("of() should create a valid key")
    void of_method_should_create_a_valid_key(){

        String givenValueKey = "test_0334";

        IdempotencyKey key = IdempotencyKey.of(givenValueKey);

        assertNotNull(key);

        assertNotNull(key.getCreatedAt());

        assertEquals(givenValueKey, key.getValue());


    }


    @Test
    @DisplayName("of() should throw an exception when the value is null")
    void of_method_should_throw_an_exception_when_the_value_is_null(){

        String givenValueKey = null;

        assertThrows(InvalidIdempotencyKeyException.class, () -> IdempotencyKey.of(givenValueKey));

    }

    @Test
    @DisplayName("valid() should check is a key has a non-null value")
    void valid_should_check_is_a_key_has_a_non_null_value(){

        String givenValueKey = "test_0334";

        IdempotencyKey key = IdempotencyKey.of(givenValueKey);

        boolean result = key.isValid();

        assertTrue(result);
    }


    @Test
    @DisplayName("of() should throw an exception when the value is blank")
    void valid_should_check_is_a_key_has_a_blank_value(){

        String givenValueKey = "";

        IdempotencyKey key = IdempotencyKey.of(givenValueKey);

        boolean result = key.isValid();

        assertTrue(result);
    }


    @Test
    @DisplayName("equals() should return true if two keys have the same value")
    void equals_should_return_true_if_two_keys_are_equal(){

        IdempotencyKey keyA = IdempotencyKey.of("test_0334");

        IdempotencyKey keyB = IdempotencyKey.of("test_0334");

        boolean result = keyA.equals(keyB);

        assertTrue(result);
    }

    @Test
    @DisplayName("equals() should return false if two keys have differents values")
    void equals_should_return_false_if_two_keys_are_different(){

        IdempotencyKey keyA = IdempotencyKey.of("test_0334");

        IdempotencyKey keyB = IdempotencyKey.of("test_0335");

        boolean result = keyA.equals(keyB);

        assertTrue(result);
    }



}
