package com.njila.njila_user_service.service.impl.manager;

import com.njila.njila_user_service.dto.request.CreateChauffeurRequest;
import com.njila.njila_user_service.dto.request.CreateGuichetierRequest;
import com.njila.njila_user_service.dto.response.UserProfileResponse;
import com.njila.njila_user_service.entity.*;
import com.njila.njila_user_service.enums.Role;
import com.njila.njila_user_service.exception.EmailAlreadyExistsException;
import com.njila.njila_user_service.exception.FilialeNotFoundException;
import com.njila.njila_user_service.exception.ForbiddenException;
import com.njila.njila_user_service.exception.ProfileNotFoundException;
import com.njila.njila_user_service.events.publisher.EventPublisher;
import com.njila.njila_user_service.events.publisher.NotificationEventPublisher;
import com.njila.njila_user_service.middleware.JwtClaims;
import com.njila.njila_user_service.repository.*;
import com.njila.njila_user_service.service.RoleManager;
import com.njila.njila_user_service.service.impl.StaffQueryService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.*;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ManagerLocalServiceImplTest {

    @Mock private UserRepository userRepository;
    @Mock private GuichetierRepository guichetierRepository;
    @Mock private ChauffeurRepository chauffeurRepository;
    @Mock private FilialeRepository filialeRepository;
    @Mock private RoleManager roleManager;
    @Mock private StaffQueryService staffQueryService;
    @Mock private EventPublisher eventPublisher;
    @Mock private NotificationEventPublisher notificationEventPublisher;

    @InjectMocks
    private ManagerLocalServiceImpl service;

    private UUID agenceId;
    private UUID filialeId;
    private UUID mlUserId;
    private JwtClaims mlCaller;
    private Filiale filiale;

    @BeforeEach
    void setUp() {
        agenceId = UUID.randomUUID();
        filialeId = UUID.randomUUID();
        mlUserId = UUID.randomUUID();

        mlCaller = mock(JwtClaims.class);
        lenient().when(mlCaller.getRole()).thenReturn(Role.MANAGER_LOCAL);
        lenient().when(mlCaller.getUserId()).thenReturn(mlUserId);
        lenient().when(mlCaller.getFilialeId()).thenReturn(filialeId);

        filiale = Filiale.builder()
                .idFiliale(filialeId)
                .agenceId(agenceId)
                .isActive(true)
                .build();
    }

    // ─────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────

    private CreateGuichetierRequest guichetierReq(String email) {
        CreateGuichetierRequest r = new CreateGuichetierRequest();
        r.setEmail(email);
        r.setName("Marie");
        r.setSurname("Curie");
        r.setPhone("690000001");
        r.setAdresse("Yaoundé");
        r.setPoste("Guichetier");
        return r;
    }

    private CreateChauffeurRequest chauffeurReq(String email) {
        CreateChauffeurRequest r = new CreateChauffeurRequest();
        r.setEmail(email);
        r.setName("Pierre");
        r.setSurname("Nkomo");
        r.setPhone("690000002");
        r.setAdresse("Douala");
        r.setNumeroPermis("PERMIS-001");
        return r;
    }

    private void mockManagerLocalProfile() {
        UserProfile profile = mock(UserProfile.class);
        lenient().when(profile.getName()).thenReturn("Admin");
        lenient().when(profile.getSurname()).thenReturn("Local");
        lenient().when(userRepository.findById(mlUserId)).thenReturn(Optional.of(profile));
    }

    private Guichetier mockGuichetierEntity() {
        Guichetier g = mock(Guichetier.class);
        UUID id = UUID.randomUUID();
        lenient().when(g.getIdUser()).thenReturn(id);
        lenient().when(g.getName()).thenReturn("Marie");
        lenient().when(g.getSurname()).thenReturn("Curie");
        lenient().when(g.getEmail()).thenReturn("marie@test.com");
        lenient().when(g.getRole()).thenReturn(Role.GUICHETIER);
        lenient().when(g.getAgenceId()).thenReturn(agenceId);
        lenient().when(g.getFilialeId()).thenReturn(filialeId);
        lenient().when(g.isActive()).thenReturn(true);
        return g;
    }

    private Chauffeur mockChauffeurEntity() {
        Chauffeur c = mock(Chauffeur.class);
        UUID id = UUID.randomUUID();
        lenient().when(c.getIdUser()).thenReturn(id);
        lenient().when(c.getName()).thenReturn("Pierre");
        lenient().when(c.getSurname()).thenReturn("Nkomo");
        lenient().when(c.getEmail()).thenReturn("pierre@test.com");
        lenient().when(c.getRole()).thenReturn(Role.CHAUFFEUR);
        lenient().when(c.getAgenceId()).thenReturn(agenceId);
        lenient().when(c.getFilialeId()).thenReturn(filialeId);
        lenient().when(c.getDisponible()).thenReturn(true);
        lenient().when(c.isActive()).thenReturn(true);
        return c;
    }

    // =====================================================
    // CREATE GUICHETIER
    // =====================================================

    @Nested
    class CreateGuichetier {

        @BeforeEach
        void setUp() {
            mockManagerLocalProfile();
        }

        @Test
        void shouldThrow_whenEmailExists() {
            when(userRepository.existsByEmail("dup@test.com")).thenReturn(true);

            assertThatThrownBy(() ->
                    service.createGuichetier(filialeId, guichetierReq("dup@test.com"), mlCaller))
                    .isInstanceOf(EmailAlreadyExistsException.class);
        }

        @Test
        void shouldThrow_whenFilialeNotFound() {
            when(userRepository.existsByEmail(any())).thenReturn(false);
            when(filialeRepository.findById(filialeId)).thenReturn(Optional.empty());

            assertThatThrownBy(() ->
                    service.createGuichetier(filialeId, guichetierReq("x@test.com"), mlCaller))
                    .isInstanceOf(FilialeNotFoundException.class);
        }
    }

    // =====================================================
    // CREATE CHAUFFEUR
    // =====================================================

    @Nested
    class CreateChauffeur {

        @BeforeEach
        void setUp() {
            mockManagerLocalProfile();
        }

        @Test
        void shouldThrow_whenEmailExists() {
            when(userRepository.existsByEmail("dup@test.com")).thenReturn(true);

            assertThatThrownBy(() ->
                    service.createChauffeur(filialeId, chauffeurReq("dup@test.com"), mlCaller))
                    .isInstanceOf(EmailAlreadyExistsException.class);
        }

        @Test
        void shouldThrow_whenFilialeNotFound() {
            when(userRepository.existsByEmail(any())).thenReturn(false);
            when(filialeRepository.findById(filialeId)).thenReturn(Optional.empty());

            assertThatThrownBy(() ->
                    service.createChauffeur(filialeId, chauffeurReq("x@test.com"), mlCaller))
                    .isInstanceOf(FilialeNotFoundException.class);
        }
    }

    // =====================================================
    // DELETE
    // =====================================================

    @Nested
    class DeleteEmploye {

        @Test
        void shouldDeleteGuichetier() {
            UUID id = UUID.randomUUID();
            Guichetier g = mockGuichetierEntity();
            when(g.getRole()).thenReturn(Role.GUICHETIER);
            when(userRepository.findById(id)).thenReturn(Optional.of(g));

            service.deleteEmploye(id, mlCaller);

            verify(userRepository).delete(g);
            verify(roleManager).assertCanDeleteUser(mlCaller, g);
        }

        @Test
        void shouldDeleteChauffeur() {
            UUID id = UUID.randomUUID();
            Chauffeur c = mockChauffeurEntity();
            when(c.getRole()).thenReturn(Role.CHAUFFEUR);
            when(userRepository.findById(id)).thenReturn(Optional.of(c));

            service.deleteEmploye(id, mlCaller);

            verify(userRepository).delete(c);
        }

        @Test
        void shouldThrow_whenManagerLocal() {
            UUID id = UUID.randomUUID();
            ManagerLocal ml = mock(ManagerLocal.class);
            when(ml.getRole()).thenReturn(Role.MANAGER_LOCAL);
            when(userRepository.findById(id)).thenReturn(Optional.of(ml));

            assertThatThrownBy(() -> service.deleteEmploye(id, mlCaller))
                    .isInstanceOf(ForbiddenException.class);
        }

        @Test
        void shouldThrow_whenNotFound() {
            when(userRepository.findById(any())).thenReturn(Optional.empty());

            assertThatThrownBy(() ->
                    service.deleteEmploye(UUID.randomUUID(), mlCaller))
                    .isInstanceOf(ProfileNotFoundException.class);
        }
    }
}