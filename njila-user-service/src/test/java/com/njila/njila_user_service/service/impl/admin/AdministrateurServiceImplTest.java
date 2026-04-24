package com.njila.njila_user_service.service.impl.admin;

import com.njila.njila_user_service.dto.request.CreateManagerGlobalRequest;
import com.njila.njila_user_service.dto.response.ManagerGlobalResponse;
import com.njila.njila_user_service.entity.Agence;
import com.njila.njila_user_service.entity.ManagerGlobal;
import com.njila.njila_user_service.entity.UserProfile;
import com.njila.njila_user_service.enums.Role;
import com.njila.njila_user_service.exception.AgenceNotFoundException;
import com.njila.njila_user_service.exception.EmailAlreadyExistsException;
import com.njila.njila_user_service.events.publisher.EventPublisher;
import com.njila.njila_user_service.events.publisher.NotificationEventPublisher;
import com.njila.njila_user_service.middleware.JwtClaims;
import com.njila.njila_user_service.repository.AgenceRepository;
import com.njila.njila_user_service.repository.ManagerGlobalRepository;
import com.njila.njila_user_service.repository.UserRepository;
import com.njila.njila_user_service.service.RoleManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AdministrateurServiceImplTest {

    @Mock private UserRepository userRepository;
    @Mock private ManagerGlobalRepository managerGlobalRepository;
    @Mock private AgenceRepository agenceRepository;
    @Mock private RoleManager roleManager;
    @Mock private EventPublisher eventPublisher;
    @Mock private NotificationEventPublisher notificationEventPublisher;

    @InjectMocks
    private AdministrateurServiceImpl service;

    private UUID agenceId;
    private UUID adminUserId;
    private JwtClaims adminCaller;
    private Agence agence;

    @BeforeEach
    void setUp() {
        agenceId = UUID.randomUUID();
        adminUserId = UUID.randomUUID();
        adminCaller = mock(JwtClaims.class);

        agence = Agence.builder()
                .idAgence(agenceId)
                .nom("Agence Centrale")
                .isActive(true)
                .build();
    }

    private CreateManagerGlobalRequest buildRequest(String email) {
        CreateManagerGlobalRequest req = new CreateManagerGlobalRequest();
        req.setEmail(email);
        req.setName("Jean");
        req.setSurname("Dupont");
        req.setPhone("690000001");
        req.setAdresse("Yaoundé");
        req.setAgenceId(agenceId.toString());
        return req;
    }

    @Nested
    class CreateManagerGlobal {

        @Test
        void createsManagerGlobal_success() {
            CreateManagerGlobalRequest req = buildRequest("jean@test.com");

            doNothing().when(roleManager).assertIsAdmin(adminCaller);
            when(adminCaller.getUserId()).thenReturn(adminUserId);
            when(userRepository.existsByEmail("jean@test.com")).thenReturn(false);
            when(agenceRepository.findById(agenceId)).thenReturn(Optional.of(agence));

            UserProfile adminProfile = mock(UserProfile.class);
            when(adminProfile.getName()).thenReturn("Super");
            when(adminProfile.getSurname()).thenReturn("Admin");
            when(userRepository.findById(adminUserId)).thenReturn(Optional.of(adminProfile));

            ManagerGlobalResponse result = service.createManagerGlobal(req, adminCaller);

            assertThat(result).isNotNull();
            verify(managerGlobalRepository).save(any(ManagerGlobal.class));
        }

        @Test
        void normalizesEmail_toLowerCase() {
            CreateManagerGlobalRequest req = buildRequest("JEAN@TEST.COM");

            doNothing().when(roleManager).assertIsAdmin(adminCaller);
            when(adminCaller.getUserId()).thenReturn(adminUserId);
            when(userRepository.existsByEmail("jean@test.com")).thenReturn(false);
            when(agenceRepository.findById(agenceId)).thenReturn(Optional.of(agence));

            UserProfile adminProfile = mock(UserProfile.class);
            when(adminProfile.getName()).thenReturn("A");
            when(adminProfile.getSurname()).thenReturn("B");
            when(userRepository.findById(adminUserId)).thenReturn(Optional.of(adminProfile));

            ManagerGlobalResponse result = service.createManagerGlobal(req, adminCaller);

            assertThat(result.getEmail()).isEqualTo("jean@test.com");
        }

        @Test
        void throws_whenEmailExists() {
            CreateManagerGlobalRequest req = buildRequest("existing@test.com");

            doNothing().when(roleManager).assertIsAdmin(adminCaller);
            when(userRepository.existsByEmail("existing@test.com")).thenReturn(true);

            assertThatThrownBy(() -> service.createManagerGlobal(req, adminCaller))
                    .isInstanceOf(EmailAlreadyExistsException.class);
        }

        @Test
        void throws_whenAgenceNotFound() {
            CreateManagerGlobalRequest req = buildRequest("nouveau@test.com");

            doNothing().when(roleManager).assertIsAdmin(adminCaller);
            when(userRepository.existsByEmail("nouveau@test.com")).thenReturn(false);
            when(agenceRepository.findById(agenceId)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.createManagerGlobal(req, adminCaller))
                    .isInstanceOf(AgenceNotFoundException.class);
        }

        @Test
        void publishesStaffToAuth() {
            CreateManagerGlobalRequest req = buildRequest("mg@test.com");

            doNothing().when(roleManager).assertIsAdmin(adminCaller);
            when(adminCaller.getUserId()).thenReturn(adminUserId);
            when(userRepository.existsByEmail("mg@test.com")).thenReturn(false);
            when(agenceRepository.findById(agenceId)).thenReturn(Optional.of(agence));

            UserProfile adminProfile = mock(UserProfile.class);
            when(userRepository.findById(adminUserId)).thenReturn(Optional.of(adminProfile));

            service.createManagerGlobal(req, adminCaller);

            verify(eventPublisher).publishStaffToAuth(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any());
        }

        @Test
        void publishesStaffCreatedNotification() {
            CreateManagerGlobalRequest req = buildRequest("mg2@test.com");

            doNothing().when(roleManager).assertIsAdmin(adminCaller);
            when(adminCaller.getUserId()).thenReturn(adminUserId);
            when(userRepository.existsByEmail("mg2@test.com")).thenReturn(false);
            when(agenceRepository.findById(agenceId)).thenReturn(Optional.of(agence));

            UserProfile adminProfile = mock(UserProfile.class);
            when(adminProfile.getName()).thenReturn("Super");
            when(adminProfile.getSurname()).thenReturn("Admin");
            when(userRepository.findById(adminUserId)).thenReturn(Optional.of(adminProfile));

            service.createManagerGlobal(req, adminCaller);

            verify(notificationEventPublisher).publishStaffCreated(anyString(), any(), any(), any(), any(), any(), any(), any(), any());
        }
    }

    @Nested
    class ListAllManagersGlobal {

        @Test
        void returnsList() {
            doNothing().when(roleManager).assertIsAdmin(adminCaller);

            ManagerGlobal mg = ManagerGlobal.builder()
                    .idUser(UUID.randomUUID())
                    .email("alice@test.com")
                    .agenceId(agenceId)
                    .isActive(true)
                    .build();

            when(managerGlobalRepository.findAll()).thenReturn(List.of(mg));

            List<ManagerGlobalResponse> result = service.listAllManagersGlobal(adminCaller);

            assertThat(result).hasSize(1);
        }

        @Test
        void returnsEmpty_whenNone() {
            doNothing().when(roleManager).assertIsAdmin(adminCaller);
            when(managerGlobalRepository.findAll()).thenReturn(List.of());

            List<ManagerGlobalResponse> result = service.listAllManagersGlobal(adminCaller);

            assertThat(result).isEmpty();
        }
    }

    @Nested
    class DeleteManagerGlobal {

        @Test
        void deletesManagerGlobal() {
            UUID managerId = UUID.randomUUID();

            doNothing().when(roleManager).assertIsAdmin(adminCaller);
            when(adminCaller.getUserId()).thenReturn(adminUserId);

            ManagerGlobal mg = ManagerGlobal.builder()
                    .idUser(managerId)
                    .email("bob@test.com")
                    .agenceId(agenceId)
                    .isActive(true)
                    .build();

            when(managerGlobalRepository.findById(managerId)).thenReturn(Optional.of(mg));

            service.deleteManagerGlobal(managerId, adminCaller);

            verify(managerGlobalRepository).delete(mg);
        }

        @Test
        void throws_whenNotFound() {
            UUID managerId = UUID.randomUUID();

            doNothing().when(roleManager).assertIsAdmin(adminCaller);
            when(managerGlobalRepository.findById(managerId)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.deleteManagerGlobal(managerId, adminCaller))
                    .isInstanceOf(RuntimeException.class);
        }
    }
}