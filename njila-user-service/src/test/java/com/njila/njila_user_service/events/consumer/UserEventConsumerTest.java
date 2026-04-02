package com.njila.njila_user_service.events.consumer;

import com.njila.njila_user_service.entity.Agence;
import com.njila.njila_user_service.entity.Filiale;
import com.njila.njila_user_service.entity.UserProfile;
import com.njila.njila_user_service.enums.Role;
import com.njila.njila_user_service.repository.AgenceRepository;
import com.njila.njila_user_service.repository.FilialeRepository;
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

    @Mock UserRepository    userRepository;
    @Mock AgenceRepository  agenceRepository;
    @Mock FilialeRepository filialeRepository;
    @Mock CacheManager      cacheManager;
    @Mock Cache             mockCache;

    @InjectMocks UserEventConsumer consumer;

    private static final UUID USER_ID    = UUID.fromString("eb4fc6e3-6d17-4543-8610-fde8509f5ca2");
    private static final UUID AGENCE_ID  = UUID.fromString("a0000000-0000-0000-0000-000000000001");
    private static final UUID FILIALE_ID = UUID.fromString("f0000000-0000-0000-0000-000000000001");

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
            "userId", USER_ID.toString(), "email", "JEAN@NJILA.CM", "name", "Jean", "surname", "D"
        ));

        ArgumentCaptor<UserProfile> cap = ArgumentCaptor.forClass(UserProfile.class);
        verify(userRepository).save(cap.capture());
        assertThat(cap.getValue().getEmail()).isEqualTo("jean@njila.cm");
    }

    @Test @DisplayName("user.registered: idempotent si profil deja existant")
    void handleUserRegistered_idempotent() {
        when(userRepository.existsById(USER_ID)).thenReturn(true);

        consumer.handleUserRegistered(Map.of("userId", USER_ID.toString(), "email", "jean@njila.cm"));

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
            .idUser(USER_ID).email("old@njila.cm").name("Jean").surname("D").role(Role.VOYAGEUR).build();
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

        // Meme photo — pas de changement
        consumer.handleUserUpdated(Map.of(
            "userId", USER_ID.toString(),
            "photoUrl", "https://cdn.njila.cm/same.jpg",
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

    @Test @DisplayName("agence.created: enregistre l agence en base")
    void handleAgenceCreated_success() {
        when(agenceRepository.existsById(AGENCE_ID)).thenReturn(false);
        when(agenceRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        consumer.handleAgenceCreated(Map.of(
            "agenceId",    AGENCE_ID.toString(),
            "nom",         "Agence Express Cameroun",
            "description", "Agence nationale"
        ));

        ArgumentCaptor<Agence> cap = ArgumentCaptor.forClass(Agence.class);
        verify(agenceRepository).save(cap.capture());
        assertThat(cap.getValue().getIdAgence()).isEqualTo(AGENCE_ID);
        assertThat(cap.getValue().getNom()).isEqualTo("Agence Express Cameroun");
        assertThat(cap.getValue().isActive()).isTrue();
    }

    @Test @DisplayName("agence.created: idempotent si agence deja existante")
    void handleAgenceCreated_idempotent() {
        when(agenceRepository.existsById(AGENCE_ID)).thenReturn(true);
        consumer.handleAgenceCreated(Map.of("agenceId", AGENCE_ID.toString(), "nom", "Test"));
        verify(agenceRepository, never()).save(any());
    }

    @Test @DisplayName("agence.created: ignore si agenceId manquant")
    void handleAgenceCreated_missingAgenceId() {
        consumer.handleAgenceCreated(Map.of("nom", "Test"));
        verify(agenceRepository, never()).save(any());
    }

    @Test @DisplayName("agence.created: ignore si nom manquant")
    void handleAgenceCreated_missingNom() {
        consumer.handleAgenceCreated(Map.of("agenceId", AGENCE_ID.toString()));
        verify(agenceRepository, never()).save(any());
    }

    // ── handleFilialeCreated ──────────────────────────────────────────────────

    @Test @DisplayName("filiale.created: enregistre la filiale si agence parente existe")
    void handleFilialeCreated_success() {
        when(filialeRepository.existsById(FILIALE_ID)).thenReturn(false);
        when(agenceRepository.existsById(AGENCE_ID)).thenReturn(true);
        when(filialeRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        consumer.handleFilialeCreated(Map.of(
            "filialeId", FILIALE_ID.toString(),
            "agenceId",  AGENCE_ID.toString(),
            "nom",       "Filiale Yaounde",
            "ville",     "Yaounde"
        ));

        ArgumentCaptor<Filiale> cap = ArgumentCaptor.forClass(Filiale.class);
        verify(filialeRepository).save(cap.capture());
        assertThat(cap.getValue().getIdFiliale()).isEqualTo(FILIALE_ID);
        assertThat(cap.getValue().getAgenceId()).isEqualTo(AGENCE_ID);
        assertThat(cap.getValue().getNom()).isEqualTo("Filiale Yaounde");
        assertThat(cap.getValue().isActive()).isTrue();
    }

    @Test @DisplayName("filiale.created: ignoree si agence parente introuvable")
    void handleFilialeCreated_agenceNotFound() {
        when(filialeRepository.existsById(FILIALE_ID)).thenReturn(false);
        when(agenceRepository.existsById(AGENCE_ID)).thenReturn(false);

        consumer.handleFilialeCreated(Map.of(
            "filialeId", FILIALE_ID.toString(),
            "agenceId",  AGENCE_ID.toString(),
            "nom",       "Filiale Test"
        ));

        verify(filialeRepository, never()).save(any());
    }

    @Test @DisplayName("filiale.created: idempotent si filiale deja existante")
    void handleFilialeCreated_idempotent() {
        when(filialeRepository.existsById(FILIALE_ID)).thenReturn(true);
        consumer.handleFilialeCreated(Map.of(
            "filialeId", FILIALE_ID.toString(),
            "agenceId",  AGENCE_ID.toString(),
            "nom",       "Test"
        ));
        verify(filialeRepository, never()).save(any());
    }

    @Test @DisplayName("filiale.created: ignore si champs manquants")
    void handleFilialeCreated_missingFields() {
        consumer.handleFilialeCreated(Map.of("filialeId", FILIALE_ID.toString()));
        verify(filialeRepository, never()).save(any());
    }

    // ── handleReservationCreated ──────────────────────────────────────────────

    @Test @DisplayName("reservation.created: ajoute entree dans historiqueResa")
    void handleReservationCreated_success() {
        UUID reservationId = UUID.randomUUID();
        UserProfile profile = UserProfile.builder()
            .idUser(USER_ID).email("jean@njila.cm").name("Jean").surname("D")
            .role(Role.VOYAGEUR).build();
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(profile));

        consumer.handleReservationCreated(Map.of(
            "userId",        USER_ID.toString(),
            "reservationId", reservationId.toString(),
            "voyageId",      UUID.randomUUID().toString(),
            "dateDepart",    "2026-04-15",
            "depart",        "Yaounde",
            "arrivee",       "Douala",
            "agenceNom",     "Agence Express",
            "statut",        "CONFIRMEE"
        ));

        verify(userRepository).save(argThat(p ->
            p.getHistoriqueResa() != null &&
            p.getHistoriqueResa().contains(reservationId.toString()) &&
            p.getHistoriqueResa().contains("Yaounde") &&
            p.getHistoriqueResa().contains("Douala")
        ));
    }

    @Test @DisplayName("reservation.created: ajoute a l historique existant")
    void handleReservationCreated_appendsToExisting() {
        UUID reservationId = UUID.randomUUID();
        UserProfile profile = UserProfile.builder()
            .idUser(USER_ID).email("jean@njila.cm").name("Jean").surname("D")
            .role(Role.VOYAGEUR)
            .historiqueResa("[2026-01-01] Yaounde -> Bafoussam | Agence A | CONFIRMEE | id=old-resa")
            .build();
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(profile));

        consumer.handleReservationCreated(Map.of(
            "userId",        USER_ID.toString(),
            "reservationId", reservationId.toString(),
            "depart",        "Yaounde",
            "arrivee",       "Douala"
        ));

        verify(userRepository).save(argThat(p ->
            p.getHistoriqueResa().contains("old-resa") &&
            p.getHistoriqueResa().contains(reservationId.toString())
        ));
    }

    @Test @DisplayName("reservation.created: ignore si userId manquant")
    void handleReservationCreated_missingUserId() {
        consumer.handleReservationCreated(Map.of("reservationId", UUID.randomUUID().toString()));
        verify(userRepository, never()).save(any());
    }

    @Test @DisplayName("reservation.created: ignore si reservationId manquant")
    void handleReservationCreated_missingReservationId() {
        consumer.handleReservationCreated(Map.of("userId", USER_ID.toString()));
        verify(userRepository, never()).save(any());
    }
}