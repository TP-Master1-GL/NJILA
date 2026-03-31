package com.njila.njila_user_service.events.consumer;

import com.njila.njila_user_service.entity.UserProfile;
import com.njila.njila_user_service.enums.Role;
import com.njila.njila_user_service.repository.UserRepository;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;

import java.util.*;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("UserEventConsumer — Tests unitaires")
class UserEventConsumerTest {

    @Mock UserRepository userRepository;
    @Mock CacheManager   cacheManager;
    @Mock Cache          mockCache;

    @InjectMocks UserEventConsumer consumer;

    @BeforeEach
    void setup() {
        when(cacheManager.getCache("userLists")).thenReturn(mockCache);
    }

    // ── user.registered ───────────────────────────────────────────────────

    @Test @DisplayName("Crée le profil voyageur en base")
    void createVoyageurProfile() {
        UUID userId = UUID.randomUUID();
        when(userRepository.existsById(userId)).thenReturn(false);
        when(userRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        consumer.handleUserRegistered(Map.of(
            "userId",  userId.toString(),
            "email",   "jean@njila.cm",
            "name",    "Jean",
            "surname", "Dupont",
            "role",    "VOYAGEUR"
        ));

        ArgumentCaptor<UserProfile> captor = ArgumentCaptor.forClass(UserProfile.class);
        verify(userRepository).save(captor.capture());
        UserProfile saved = captor.getValue();
        assertThat(saved.getIdUser()).isEqualTo(userId);
        assertThat(saved.getEmail()).isEqualTo("jean@njila.cm");
        assertThat(saved.getRole()).isEqualTo(Role.VOYAGEUR);
        assertThat(saved.isActive()).isTrue();
    }

    @Test @DisplayName("Idempotent — ignoré si profil existant")
    void idempotentRegistered() {
        UUID userId = UUID.randomUUID();
        when(userRepository.existsById(userId)).thenReturn(true);
        consumer.handleUserRegistered(Map.of(
            "userId", userId.toString(), "email", "jean@njila.cm"
        ));
        verify(userRepository, never()).save(any());
    }

    @Test @DisplayName("Ignoré si userId manquant")
    void missingUserId() {
        consumer.handleUserRegistered(Map.of("email", "jean@njila.cm"));
        verify(userRepository, never()).save(any());
    }

    // ── user.updated ──────────────────────────────────────────────────────

    @Test @DisplayName("Met à jour la photo de profil")
    void updatePhoto() {
        UUID userId = UUID.randomUUID();
        UserProfile profile = UserProfile.builder()
            .idUser(userId).email("jean@njila.cm")
            .name("Jean").surname("Dupont").role(Role.VOYAGEUR)
            .photoProfil("https://cdn.njila.cm/old.jpg")
            .build();

        when(userRepository.findById(userId)).thenReturn(Optional.of(profile));
        when(cacheManager.getCache("profiles")).thenReturn(mockCache);

        consumer.handleUserUpdated(Map.of(
            "userId",       userId.toString(),
            "photoUrl",     "https://cdn.njila.cm/new.jpg",
            "emailChanged", false
        ));

        assertThat(profile.getPhotoProfil()).isEqualTo("https://cdn.njila.cm/new.jpg");
        verify(userRepository).save(profile);
    }

    @Test @DisplayName("Ignoré si userId manquant dans user.updated")
    void updatedMissingUserId() {
        consumer.handleUserUpdated(Map.of("photoUrl", "https://cdn.njila.cm/photo.jpg"));
        verify(userRepository, never()).save(any());
    }

    // ── staff.created ─────────────────────────────────────────────────────

    @Test @DisplayName("Crée le profil guichetier")
    void createGuichetierProfile() {
        UUID userId    = UUID.randomUUID();
        UUID filialeId = UUID.randomUUID();
        UUID agenceId  = UUID.randomUUID();

        when(userRepository.existsById(userId)).thenReturn(false);
        when(userRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Map<String, Object> payload = new HashMap<>();
        payload.put("userId",    userId.toString());
        payload.put("email",     "agent@njila.cm");
        payload.put("name",      "Paul");
        payload.put("surname",   "Biya");
        payload.put("role",      "GUICHETIER");
        payload.put("filialeId", filialeId.toString());
        payload.put("agenceId",  agenceId.toString());

        consumer.handleStaffCreated(payload);

        ArgumentCaptor<UserProfile> captor = ArgumentCaptor.forClass(UserProfile.class);
        verify(userRepository).save(captor.capture());
        UserProfile saved = captor.getValue();
        assertThat(saved.getRole()).isEqualTo(Role.GUICHETIER);
        assertThat(saved.getFilialeId()).isEqualTo(filialeId);
        assertThat(saved.getAgenceId()).isEqualTo(agenceId);
        assertThat(saved.isActive()).isTrue();
    }

    @Test @DisplayName("Idempotent — staff ignoré si profil existant")
    void idempotentStaff() {
        UUID userId = UUID.randomUUID();
        when(userRepository.existsById(userId)).thenReturn(true);
        consumer.handleStaffCreated(Map.of(
            "userId", userId.toString(), "email", "agent@njila.cm"
        ));
        verify(userRepository, never()).save(any());
    }
}