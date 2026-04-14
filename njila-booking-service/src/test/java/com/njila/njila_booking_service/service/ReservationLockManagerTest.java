package com.njila.njila_booking_service.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import java.time.Duration;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ReservationLockManagerTest {

    @Mock
    private RedisTemplate<String, String> redisTemplate;

    @Mock
    private ValueOperations<String, String> valueOperations;

    @InjectMocks
    private ReservationLockManager lockManager;

    // ─── Pas de @BeforeEach avec stub global ─────────────────────────────────
    // Chaque test configure son propre stub pour éviter UnnecessaryStubbingException

    @Test
    void acquerirVerrou_succes() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.setIfAbsent(
                "njila:booking:lock:voyage-1:user-1", "100",
                Duration.ofMinutes(10)))
                .thenReturn(true);

        boolean result = lockManager.acquerirVerrou("voyage-1", "user-1", 100L);

        assertThat(result).isTrue();
        verify(valueOperations).setIfAbsent(
                "njila:booking:lock:voyage-1:user-1", "100",
                Duration.ofMinutes(10));
    }

    @Test
    void acquerirVerrou_dejaExistant_retourneFalse() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.setIfAbsent(any(), any(), any()))
                .thenReturn(false);

        boolean result = lockManager.acquerirVerrou("voyage-1", "user-1", 100L);

        assertThat(result).isFalse();
    }

    @Test
    void libererVerrou_supprimeLaCle() {
        lockManager.libererVerrou("voyage-1", "user-1");
        verify(redisTemplate).delete("njila:booking:lock:voyage-1:user-1");
    }

    @Test
    void verifierVerrou_cleExistante_retourneTrue() {
        when(redisTemplate.hasKey("njila:booking:lock:voyage-1:user-1")).thenReturn(true);
        assertThat(lockManager.verifierVerrou("voyage-1", "user-1")).isTrue();
    }

    @Test
    void verifierVerrou_cleAbsente_retourneFalse() {
        when(redisTemplate.hasKey("njila:booking:lock:voyage-1:user-1")).thenReturn(false);
        assertThat(lockManager.verifierVerrou("voyage-1", "user-1")).isFalse();
    }

    @Test
    void getCleVerrou_formatCorrect() {
        String cle = lockManager.getCleVerrou("voyage-5", "user-10");
        assertThat(cle).isEqualTo("njila:booking:lock:voyage-5:user-10");
    }
}
