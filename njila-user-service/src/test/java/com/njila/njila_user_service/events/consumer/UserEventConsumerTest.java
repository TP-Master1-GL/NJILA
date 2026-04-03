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
@DisplayName("UserEventConsumer — Handlers RabbitMQ v2.0")
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

    // ── handleAgenceCreated ───────────────────────────────────────────────────

    @Test @DisplayName("agence.created: ne fait rien pour l'instant (log seulement)")
    void handleAgenceCreated_logsOnly() {
        // Cette méthode est vide pour l'instant, on vérifie juste qu'elle ne lance pas d'exception
        assertThatNoException().isThrownBy(() -> 
            consumer.handleAgenceCreated(Map.of("agenceId", AGENCE_ID.toString(), "nom", "Agence Test"))
        );
        verify(userRepository, never()).save(any());
    }

    // ── handleFilialeCreated ──────────────────────────────────────────────────

    @Test @DisplayName("filiale.created: ne fait rien pour l'instant (log seulement)")
    void handleFilialeCreated_logsOnly() {
        assertThatNoException().isThrownBy(() -> 
            consumer.handleFilialeCreated(Map.of("filialeId", FILIALE_ID.toString(), "nom", "Filiale Test"))
        );
        verify(userRepository, never()).save(any());
    }

    // ── handleReservationCreated ──────────────────────────────────────────────

    @Test @DisplayName("reservation.created: ne fait rien pour l'instant (log seulement)")
    void handleReservationCreated_logsOnly() {
        assertThatNoException().isThrownBy(() -> 
            consumer.handleReservationCreated(Map.of("reservationId", UUID.randomUUID().toString()))
        );
        verify(userRepository, never()).save(any());
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static final UUID AGENCE_ID  = UUID.fromString("a0000000-0000-0000-0000-000000000001");
    private static final UUID FILIALE_ID = UUID.fromString("f0000000-0000-0000-0000-000000000001");
}