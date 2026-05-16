package com.njila.njila_user_service.service.impl.agent;

import com.njila.njila_user_service.dto.response.UserProfileResponse;
import com.njila.njila_user_service.entity.Chauffeur;
import com.njila.njila_user_service.entity.Guichetier;
import com.njila.njila_user_service.enums.Role;
import com.njila.njila_user_service.exception.ForbiddenException;
import com.njila.njila_user_service.exception.ProfileNotFoundException;
import com.njila.njila_user_service.middleware.JwtClaims;
import com.njila.njila_user_service.repository.ChauffeurRepository;
import com.njila.njila_user_service.repository.GuichetierRepository;
import com.njila.njila_user_service.repository.UserRepository;
import com.njila.njila_user_service.service.RoleManager;
import com.njila.njila_user_service.service.impl.StaffQueryService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class EmployeFilialeServiceImplTest {

    @Mock private UserRepository userRepository;
    @Mock private GuichetierRepository guichetierRepository;
    @Mock private ChauffeurRepository chauffeurRepository;
    @Mock private RoleManager roleManager;
    @Mock private StaffQueryService staffQueryService;

    @InjectMocks
    private EmployeFilialeServiceImpl service;

    private UUID agenceId;
    private UUID filialeId;
    private UUID employeId;
    private UUID chauffeurId;
    private JwtClaims adminCaller;
    private JwtClaims mlCaller;
    private JwtClaims mgCaller;

    @BeforeEach
    void setUp() {
        agenceId = UUID.randomUUID();
        filialeId = UUID.randomUUID();
        employeId = UUID.randomUUID();
        chauffeurId = UUID.randomUUID();

        adminCaller = mock(JwtClaims.class);
        when(adminCaller.getRole()).thenReturn(Role.ADMINISTRATEUR);
        when(adminCaller.getUserId()).thenReturn(UUID.randomUUID());

        mlCaller = mock(JwtClaims.class);
        when(mlCaller.getRole()).thenReturn(Role.MANAGER_LOCAL);
        when(mlCaller.getUserId()).thenReturn(UUID.randomUUID());
        when(mlCaller.getFilialeId()).thenReturn(filialeId);

        mgCaller = mock(JwtClaims.class);
        when(mgCaller.getRole()).thenReturn(Role.MANAGER_GLOBAL);
        when(mgCaller.getUserId()).thenReturn(UUID.randomUUID());
        when(mgCaller.getAgenceId()).thenReturn(agenceId);
    }

    // Helpers
    private Guichetier buildGuichetier(UUID agence, UUID filiale) {
        Guichetier g = mock(Guichetier.class);
        when(g.getIdUser()).thenReturn(employeId);
        when(g.getName()).thenReturn("Guichetier");
        when(g.getSurname()).thenReturn("Test");
        when(g.getEmail()).thenReturn("guichetier@test.com");
        when(g.getRole()).thenReturn(Role.GUICHETIER);
        when(g.getAgenceId()).thenReturn(agence);
        when(g.getFilialeId()).thenReturn(filiale);
        when(g.isActive()).thenReturn(true);
        return g;
    }

    private Chauffeur buildChauffeur(UUID agence, UUID filiale) {
        Chauffeur c = mock(Chauffeur.class);
        when(c.getIdUser()).thenReturn(chauffeurId);
        when(c.getName()).thenReturn("Chauffeur");
        when(c.getSurname()).thenReturn("Test");
        when(c.getEmail()).thenReturn("chauffeur@test.com");
        when(c.getRole()).thenReturn(Role.CHAUFFEUR);
        when(c.getAgenceId()).thenReturn(agence);
        when(c.getFilialeId()).thenReturn(filiale);
        when(c.getDisponible()).thenReturn(true);
        when(c.isActive()).thenReturn(true);
        return c;
    }

    // =========================================================================
    // getEmployeProfile
    // =========================================================================

    @Nested
    @DisplayName("getEmployeProfile")
    class GetEmployeProfile {

        @Test
        void admin_canViewAnyProfile() {
            Guichetier g = buildGuichetier(agenceId, filialeId);
            when(userRepository.findById(employeId)).thenReturn(Optional.of(g));

            UserProfileResponse result = service.getEmployeProfile(employeId, adminCaller);

            assertThat(result).isNotNull();
        }

        @Test
        void managerLocal_canViewOwnFilialeEmployee() {
            Guichetier g = buildGuichetier(agenceId, filialeId);
            when(userRepository.findById(employeId)).thenReturn(Optional.of(g));

            UserProfileResponse result = service.getEmployeProfile(employeId, mlCaller);

            assertThat(result).isNotNull();
        }

        @Test
        void managerLocal_cannotViewOtherFilialeEmployee() {
            UUID autreFiliale = UUID.randomUUID();
            Guichetier g = buildGuichetier(agenceId, autreFiliale);
            when(userRepository.findById(employeId)).thenReturn(Optional.of(g));

            assertThatThrownBy(() -> service.getEmployeProfile(employeId, mlCaller))
                    .isInstanceOf(ForbiddenException.class);
        }

        @Test
        void managerGlobal_canViewOwnAgenceEmployee() {
            Guichetier g = buildGuichetier(agenceId, filialeId);
            when(userRepository.findById(employeId)).thenReturn(Optional.of(g));

            UserProfileResponse result = service.getEmployeProfile(employeId, mgCaller);

            assertThat(result).isNotNull();
        }

        @Test
        void managerGlobal_cannotViewOtherAgenceEmployee() {
            UUID autreAgence = UUID.randomUUID();
            Guichetier g = buildGuichetier(autreAgence, filialeId);
            when(userRepository.findById(employeId)).thenReturn(Optional.of(g));

            assertThatThrownBy(() -> service.getEmployeProfile(employeId, mgCaller))
                    .isInstanceOf(ForbiddenException.class);
        }

        @Test
        void throws_whenNotFound() {
            when(userRepository.findById(employeId)).thenReturn(Optional.empty());

            assertThatThrownBy(() ->
                    service.getEmployeProfile(employeId, adminCaller)
            ).isInstanceOf(ProfileNotFoundException.class);
        }
    }

    // =========================================================================
    // getAllEmployesByFiliale
    // =========================================================================

    @Nested
    @DisplayName("getAllEmployesByFiliale")
    class GetAllEmployesByFiliale {

        @Test
        void returnsEmployes() {
            Guichetier g = buildGuichetier(agenceId, filialeId);
            when(staffQueryService.findAllEmployesByFilialeId(filialeId)).thenReturn(List.of(g));

            List<UserProfileResponse> result = service.getAllEmployesByFiliale(filialeId, mlCaller);

            assertThat(result).hasSize(1);
            verify(roleManager).assertCanViewEmployesByFiliale(mlCaller, filialeId);
        }

        @Test
        void returnsEmpty_whenNone() {
            when(staffQueryService.findAllEmployesByFilialeId(filialeId)).thenReturn(List.of());

            List<UserProfileResponse> result = service.getAllEmployesByFiliale(filialeId, mlCaller);

            assertThat(result).isEmpty();
        }
    }

    // =========================================================================
    // updateDisponibilite
    // =========================================================================

    @Nested
    @DisplayName("updateDisponibilite")
    class UpdateDisponibilite {

        @Test
        void managerLocal_canUpdate_ownFilialeChauffeur() {
            Chauffeur c = buildChauffeur(agenceId, filialeId);
            when(chauffeurRepository.findById(chauffeurId)).thenReturn(Optional.of(c));

            service.updateDisponibilite(chauffeurId, false, mlCaller);

            verify(c).setDisponible(false);
            verify(chauffeurRepository).save(c);
        }

        @Test
        void managerLocal_cannotUpdate_otherFilialeChauffeur() {
            UUID autreFiliale = UUID.randomUUID();
            Chauffeur c = buildChauffeur(agenceId, autreFiliale);
            when(chauffeurRepository.findById(chauffeurId)).thenReturn(Optional.of(c));

            assertThatThrownBy(() -> service.updateDisponibilite(chauffeurId, false, mlCaller))
                    .isInstanceOf(ForbiddenException.class);
        }

        @Test
        void managerGlobal_canUpdate_ownAgenceChauffeur() {
            Chauffeur c = buildChauffeur(agenceId, filialeId);
            when(chauffeurRepository.findById(chauffeurId)).thenReturn(Optional.of(c));

            service.updateDisponibilite(chauffeurId, false, mgCaller);

            verify(c).setDisponible(false);
            verify(chauffeurRepository).save(c);
        }

        @Test
        void managerGlobal_cannotUpdate_otherAgenceChauffeur() {
            UUID autreAgence = UUID.randomUUID();
            Chauffeur c = buildChauffeur(autreAgence, filialeId);
            when(chauffeurRepository.findById(chauffeurId)).thenReturn(Optional.of(c));

            assertThatThrownBy(() -> service.updateDisponibilite(chauffeurId, false, mgCaller))
                    .isInstanceOf(ForbiddenException.class);
        }

        @Test
        void admin_canUpdateAnyChauffeur() {
            Chauffeur c = buildChauffeur(agenceId, filialeId);
            when(chauffeurRepository.findById(chauffeurId)).thenReturn(Optional.of(c));

            service.updateDisponibilite(chauffeurId, true, adminCaller);

            verify(c).setDisponible(true);
            verify(chauffeurRepository).save(c);
        }

        @Test
        void chauffeur_canUpdateOwnDisponibilite() {
            JwtClaims selfCaller = mock(JwtClaims.class);
            when(selfCaller.getRole()).thenReturn(Role.CHAUFFEUR);
            when(selfCaller.getUserId()).thenReturn(chauffeurId);

            Chauffeur c = buildChauffeur(agenceId, filialeId);
            when(chauffeurRepository.findById(chauffeurId)).thenReturn(Optional.of(c));

            service.updateDisponibilite(chauffeurId, false, selfCaller);

            verify(c).setDisponible(false);
            verify(chauffeurRepository).save(c);
        }

        @Test
        void chauffeur_cannotUpdateOtherChauffeur() {
            JwtClaims otherCaller = mock(JwtClaims.class);
            when(otherCaller.getRole()).thenReturn(Role.CHAUFFEUR);
            when(otherCaller.getUserId()).thenReturn(UUID.randomUUID());

            Chauffeur c = buildChauffeur(agenceId, filialeId);
            when(chauffeurRepository.findById(chauffeurId)).thenReturn(Optional.of(c));

            assertThatThrownBy(() -> service.updateDisponibilite(chauffeurId, false, otherCaller))
                    .isInstanceOf(ForbiddenException.class);
        }

        @Test
        void throws_whenNotFound() {
            when(chauffeurRepository.findById(chauffeurId)).thenReturn(Optional.empty());

            assertThatThrownBy(() ->
                    service.updateDisponibilite(chauffeurId, true, adminCaller)
            ).isInstanceOf(ProfileNotFoundException.class);
        }
    }
}