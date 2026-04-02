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
@DisplayName("UserEventConsumer — Handlers RabbitMQ")
class UserEventConsumerTest {

    @Mock UserRepository userRepository;
    @Mock CacheManager   cacheManager;
    @Mock Cache          mockCache;

    @InjectMocks UserEventConsumer consumer;

    private static final UUID USER_ID = UUID.fromString("eb4fc6e3-6d17-4543-8610-fde8509f5ca2");

    @BeforeEach
    void setUp() {
        lenient().when(cacheManager.getCache("userLists")).thenReturn(mockCache);
        lenient().when(cacheManager.getCache("profiles")).thenReturn(mockCache);
    }

    // ── handleUserRegistered ──────────────────────────────────────────────────

    @Test @DisplayName("user.registered: cree profil voyageur en base")
    void handleUserRegistered_createsProfile() {
        when(userRepository.existsById(USER_ID)).thenReturn(false);
        when(userRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        consumer.handleUserRegistered(Map.of(
            "userId",  USER_ID.toString(),
            "email",   "jean@njila.cm",
            "name",    "Jean",
            "surname", "Dupont",
            "role",    "VOYAGEUR"
        ));

        ArgumentCaptor<UserProfile> cap = ArgumentCaptor.forClass(UserProfile.class);
        verify(userRepository).save(cap.capture());
        assertThat(cap.getValue().getIdUser()).isEqualTo(USER_ID);
        assertThat(cap.getValue().getEmail()).isEqualTo("jean@njila.cm");
        assertThat(cap.getValue().getRole()).isEqualTo(Role.VOYAGEUR);
        assertThat(cap.getValue().isActive()).isTrue();
    }

    @Test @DisplayName("user.registered: email normalise en minuscules")
    void handleUserRegistered_emailNormalized() {
        when(userRepository.existsById(USER_ID)).thenReturn(false);
        when(userRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        consumer.handleUserRegistered(Map.of(
            "userId", USER_ID.toString(), "email", "JEAN@NJILA.CM",
            "name", "Jean", "surname", "D"
        ));

        ArgumentCaptor<UserProfile> cap = ArgumentCaptor.forClass(UserProfile.class);
        verify(userRepository).save(cap.capture());
        assertThat(cap.getValue().getEmail()).isEqualTo("jean@njila.cm");
    }

    @Test @DisplayName("user.registered: idempotent si profil deja existant")
    void handleUserRegistered_idempotent() {
        when(userRepository.existsById(USER_ID)).thenReturn(true);
        consumer.handleUserRegistered(Map.of(
            "userId", USER_ID.toString(), "email", "jean@njila.cm"
        ));
        verify(userRepository, never()).save(any());
    }

    @Test @DisplayName("user.registered: ignore si userId manquant")
    void handleUserRegistered_missingUserId() {
        consumer.handleUserRegistered(Map.of("email", "jean@njila.cm"));
        verify(userRepository, never()).save(any());
    }

    @Test @DisplayName("user.registered: ignore si email manquant")
    void handleUserRegistered_missingEmail() {
        consumer.handleUserRegistered(Map.of("userId", USER_ID.toString()));
        verify(userRepository, never()).save(any());
    }

    @Test @DisplayName("user.registered: role inconnu -> VOYAGEUR par defaut")
    void handleUserRegistered_unknownRole_defaultsToVoyageur() {
        when(userRepository.existsById(USER_ID)).thenReturn(false);
        when(userRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        consumer.handleUserRegistered(Map.of(
            "userId", USER_ID.toString(), "email", "jean@njila.cm",
            "name", "Jean", "surname", "D", "role", "ROLE_INCONNU"
        ));

        ArgumentCaptor<UserProfile> cap = ArgumentCaptor.forClass(UserProfile.class);
        verify(userRepository).save(cap.capture());
        assertThat(cap.getValue().getRole()).isEqualTo(Role.VOYAGEUR);
    }

    // ── handleUserUpdated ─────────────────────────────────────────────────────

    @Test @DisplayName("user.updated: met a jour la photo de profil")
    void handleUserUpdated_photoUpdated() {
        UserProfile profile = UserProfile.builder()
            .idUser(USER_ID).email("jean@njila.cm").name("Jean").surname("D")
            .role(Role.VOYAGEUR).photoProfil("https://cdn.njila.cm/old.jpg").build();
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(profile));

        consumer.handleUserUpdated(Map.of(
            "userId",       USER_ID.toString(),
            "photoUrl",     "https://cdn.njila.cm/new.jpg",
            "emailChanged", false
        ));

        assertThat(profile.getPhotoProfil()).isEqualTo("https://cdn.njila.cm/new.jpg");
        verify(userRepository).save(profile);
    }

    @Test @DisplayName("user.updated: met a jour l email si emailChanged=true")
    void handleUserUpdated_emailChanged() {
        UserProfile profile = UserProfile.builder()
            .idUser(USER_ID).email("old@njila.cm").name("Jean").surname("D")
            .role(Role.VOYAGEUR).build();
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(profile));

        Map<String, Object> payload = new HashMap<>();
        payload.put("userId", USER_ID.toString());
        payload.put("emailChanged", true);
        payload.put("email", "new@njila.cm");
        consumer.handleUserUpdated(payload);

        assertThat(profile.getEmail()).isEqualTo("new@njila.cm");
        verify(userRepository).save(profile);
    }

    @Test @DisplayName("user.updated: pas de sauvegarde si rien ne change")
    void handleUserUpdated_noChange() {
        UserProfile profile = UserProfile.builder()
            .idUser(USER_ID).email("jean@njila.cm").name("Jean").surname("D")
            .role(Role.VOYAGEUR).photoProfil("https://cdn.njila.cm/same.jpg").build();
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(profile));

        consumer.handleUserUpdated(Map.of(
            "userId",       USER_ID.toString(),
            "photoUrl",     "https://cdn.njila.cm/same.jpg",
            "emailChanged", false
        ));

        verify(userRepository, never()).save(any());
    }

    @Test @DisplayName("user.updated: ignore si userId manquant")
    void handleUserUpdated_missingUserId() {
        consumer.handleUserUpdated(Map.of("photoUrl", "https://cdn.njila.cm/photo.jpg"));
        verify(userRepository, never()).save(any());
    }

    // ── handleStaffCreated ────────────────────────────────────────────────────

    @Test @DisplayName("staff.created: cree profil guichetier")
    void handleStaffCreated_createsGuichetier() {
        UUID userId    = UUID.randomUUID();
        UUID filialeId = UUID.randomUUID();
        UUID agenceId  = UUID.randomUUID();

        when(userRepository.existsById(userId)).thenReturn(false);
        when(userRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        Map<String, Object> payload = new HashMap<>();
        payload.put("userId",    userId.toString());
        payload.put("email",     "agent@njila.cm");
        payload.put("name",      "Paul");
        payload.put("surname",   "Biya");
        payload.put("role",      "GUICHETIER");
        payload.put("filialeId", filialeId.toString());
        payload.put("agenceId",  agenceId.toString());

        consumer.handleStaffCreated(payload);

        ArgumentCaptor<UserProfile> cap = ArgumentCaptor.forClass(UserProfile.class);
        verify(userRepository).save(cap.capture());
        assertThat(cap.getValue().getRole()).isEqualTo(Role.GUICHETIER);
        assertThat(cap.getValue().getFilialeId()).isEqualTo(filialeId);
        assertThat(cap.getValue().isActive()).isTrue();
    }

    @Test @DisplayName("staff.created: idempotent si profil existant")
    void handleStaffCreated_idempotent() {
        UUID userId = UUID.randomUUID();
        when(userRepository.existsById(userId)).thenReturn(true);
        consumer.handleStaffCreated(Map.of(
            "userId", userId.toString(), "email", "agent@njila.cm"
        ));
        verify(userRepository, never()).save(any());
    }

    @Test @DisplayName("staff.created: ignore si userId manquant")
    void handleStaffCreated_missingUserId() {
        consumer.handleStaffCreated(Map.of("email", "agent@njila.cm"));
        verify(userRepository, never()).save(any());
    }
}