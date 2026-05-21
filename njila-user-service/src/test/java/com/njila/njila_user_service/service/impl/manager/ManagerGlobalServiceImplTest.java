package com.njila.njila_user_service.service.impl.manager;

import com.njila.njila_user_service.events.publisher.EventPublisher;
import com.njila.njila_user_service.events.publisher.NotificationEventPublisher;
import com.njila.njila_user_service.dto.request.CreateManagerLocalRequest;
import com.njila.njila_user_service.dto.response.ManagerLocalResponse;
import com.njila.njila_user_service.dto.response.UserProfileResponse;
import com.njila.njila_user_service.entity.*;
import com.njila.njila_user_service.enums.Role;
import com.njila.njila_user_service.exception.EmailAlreadyExistsException;
import com.njila.njila_user_service.exception.FilialeNotFoundException;
import com.njila.njila_user_service.exception.ForbiddenException;
import com.njila.njila_user_service.middleware.JwtClaims;
import com.njila.njila_user_service.repository.FilialeRepository;
import com.njila.njila_user_service.repository.ManagerLocalRepository;
import com.njila.njila_user_service.repository.UserRepository;
import com.njila.njila_user_service.service.RoleManager;
import com.njila.njila_user_service.service.impl.StaffQueryService;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.*;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ManagerGlobalServiceImplTest {

    @Mock private UserRepository userRepository;
    @Mock private ManagerLocalRepository managerLocalRepository;
    @Mock private FilialeRepository filialeRepository;
    @Mock private RoleManager roleManager;
    @Mock private StaffQueryService staffQueryService;
    @Mock private EventPublisher eventPublisher;
    @Mock private NotificationEventPublisher notificationEventPublisher;

    @InjectMocks
    private ManagerGlobalServiceImpl service;

    private UUID agenceId;
    private UUID filialeId;
    private UUID mgUserId;
    private JwtClaims mgCaller;
    private Filiale filiale;

    // ─────────────────────────────────────────────
    // SETUP
    // ─────────────────────────────────────────────
    @BeforeEach
    void setUp() {
        agenceId = UUID.randomUUID();
        filialeId = UUID.randomUUID();
        mgUserId = UUID.randomUUID();

        mgCaller = mock(JwtClaims.class);
        when(mgCaller.getRole()).thenReturn(Role.MANAGER_GLOBAL);
        when(mgCaller.getUserId()).thenReturn(mgUserId);
        when(mgCaller.getAgenceId()).thenReturn(agenceId);

        filiale = Filiale.builder()
                .idFiliale(filialeId)
                .nom("Filiale Nord")
                .agenceId(agenceId)
                .isActive(true)
                .build();
    }

    // ─────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────
    private CreateManagerLocalRequest createRequest(String email) {
        CreateManagerLocalRequest req = new CreateManagerLocalRequest();
        req.setEmail(email);
        req.setName("Paul");
        req.setSurname("Biya");
        req.setPhone("677000002");
        req.setAdresse("Douala");
        req.setFilialeId(filialeId.toString());
        return req;
    }

    private ManagerLocal mockManagerLocal() {
        ManagerLocal ml = mock(ManagerLocal.class);
        when(ml.getIdUser()).thenReturn(UUID.randomUUID());
        when(ml.getName()).thenReturn("ML");
        when(ml.getSurname()).thenReturn("LOCAL");
        when(ml.getEmail()).thenReturn("ml@test.com");
        when(ml.getRole()).thenReturn(Role.MANAGER_LOCAL);
        when(ml.getAgenceId()).thenReturn(agenceId);
        when(ml.getFilialeId()).thenReturn(filialeId);
        when(ml.isActive()).thenReturn(true);
        return ml;
    }

    private UserProfile mockGuichetier() {
        Guichetier g = mock(Guichetier.class);
        when(g.getIdUser()).thenReturn(UUID.randomUUID());
        when(g.getName()).thenReturn("G");
        when(g.getSurname()).thenReturn("Gs");
        when(g.getEmail()).thenReturn("g@test.com");
        when(g.getRole()).thenReturn(Role.GUICHETIER);
        when(g.getAgenceId()).thenReturn(agenceId);
        when(g.getFilialeId()).thenReturn(filialeId);
        when(g.isActive()).thenReturn(true);
        return g;
    }

    // ─────────────────────────────────────────────
    // listStaffByAgence
    // ─────────────────────────────────────────────
    @Nested
    class ListStaffByAgence {

        @Test
        void shouldReturnAllStaff_whenNoTypeProvided() {
            UserProfile g = mockGuichetier();

            when(staffQueryService.findAllStaffByAgenceId(agenceId))
                    .thenReturn(List.of(g));

            List<UserProfileResponse> result =
                    service.listStaffByAgence(agenceId, null, mgCaller);

            assertThat(result).hasSize(1);
            verify(roleManager).assertCanViewStaffByAgence(mgCaller, agenceId);
        }

        @Test
        void shouldReturnEmptyList_whenNoStaff() {
            when(staffQueryService.findAllStaffByAgenceId(agenceId))
                    .thenReturn(List.of());

            List<UserProfileResponse> result =
                    service.listStaffByAgence(agenceId, null, mgCaller);

            assertThat(result).isEmpty();
        }

        @Test
        void shouldFilterManagerLocaux() {
            ManagerLocal ml = mockManagerLocal();

            when(staffQueryService.findAllManagerLocauxByAgenceId(agenceId))
                    .thenReturn(List.of(ml));

            List<UserProfileResponse> result =
                    service.listStaffByAgence(agenceId, "MANAGER_LOCAL", mgCaller);

            assertThat(result).hasSize(1);
            verify(staffQueryService).findAllManagerLocauxByAgenceId(agenceId);
        }

        @Test
        void shouldFilterEmployes() {
            UserProfile g = mockGuichetier();

            when(staffQueryService.findAllEmployesByAgenceId(agenceId))
                    .thenReturn(List.of(g));

            List<UserProfileResponse> result =
                    service.listStaffByAgence(agenceId, "EMPLOYE", mgCaller);

            assertThat(result).hasSize(1);
            verify(staffQueryService).findAllEmployesByAgenceId(agenceId);
        }
    }

    // ─────────────────────────────────────────────
    // createManagerLocal
    // ─────────────────────────────────────────────
    @Nested
    class CreateManagerLocal {

        @Test
        void shouldThrow_whenEmailExists() {
            CreateManagerLocalRequest req = createRequest("exists@test.com");

            when(userRepository.existsByEmail("exists@test.com")).thenReturn(true);

            assertThatThrownBy(() ->
                    service.createManagerLocal(agenceId, req, mgCaller))
                    .isInstanceOf(EmailAlreadyExistsException.class);

            verify(managerLocalRepository, never()).save(any());
        }

        @Test
        void shouldThrow_whenFilialeNotFound() {
            CreateManagerLocalRequest req = createRequest("filiale@test.com");

            when(userRepository.existsByEmail("filiale@test.com")).thenReturn(false);
            when(filialeRepository.findById(filialeId)).thenReturn(Optional.empty());

            assertThatThrownBy(() ->
                    service.createManagerLocal(agenceId, req, mgCaller))
                    .isInstanceOf(FilialeNotFoundException.class);
        }
    }

    // ─────────────────────────────────────────────
    // deleteStaff
    // ─────────────────────────────────────────────
    @Nested
    class DeleteStaff {

        @Test
        void shouldDeleteStaff_success() {
            UUID id = UUID.randomUUID();
            UserProfile user = mockGuichetier();

            when(userRepository.findById(id)).thenReturn(Optional.of(user));
            doNothing().when(roleManager).assertCanDeleteUser(mgCaller, user);

            service.deleteStaff(id, mgCaller);

            verify(userRepository).delete(user);
        }

        @Test
        void shouldThrow_whenNotFound() {
            UUID id = UUID.randomUUID();

            when(userRepository.findById(id)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.deleteStaff(id, mgCaller))
                    .isInstanceOf(RuntimeException.class);
        }
    }
}