package com.njila.njila_user_service.service.impl;

import com.njila.njila_user_service.entity.*;
import com.njila.njila_user_service.repository.ChauffeurRepository;
import com.njila.njila_user_service.repository.GuichetierRepository;
import com.njila.njila_user_service.repository.ManagerLocalRepository;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class StaffQueryServiceTest {

    @Mock private ManagerLocalRepository managerLocalRepository;
    @Mock private GuichetierRepository guichetierRepository;
    @Mock private ChauffeurRepository chauffeurRepository;

    @InjectMocks
    private StaffQueryService staffQueryService;

    private UUID agenceId;
    private UUID filialeId;

    @BeforeEach
    void setUp() {
        agenceId = UUID.randomUUID();
        filialeId = UUID.randomUUID();
    }

    // ─────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────
    private ManagerLocal managerLocal() {
        return ManagerLocal.builder()
                .idUser(UUID.randomUUID())
                .name("ML")
                .surname("LOCAL")
                .email("ml@test.com")
                .agenceId(agenceId)
                .filialeId(filialeId)
                .isActive(true)
                .build();
    }

    private Guichetier guichetier() {
        return Guichetier.builder()
                .idUser(UUID.randomUUID())
                .name("G")
                .surname("USER")
                .email("g@test.com")
                .agenceId(agenceId)
                .filialeId(filialeId)
                .isActive(true)
                .build();
    }

    private Chauffeur chauffeur() {
        return Chauffeur.builder()
                .idUser(UUID.randomUUID())
                .name("C")
                .surname("DRIVER")
                .email("c@test.com")
                .agenceId(agenceId)
                .filialeId(filialeId)
                .disponible(true)
                .isActive(true)
                .build();
    }

    // ─────────────────────────────────────────────
    // findAllStaffByAgenceId
    // ─────────────────────────────────────────────
    @Nested
    class FindAllStaffByAgenceId {

        @Test
        void shouldReturnUnionOfAllStaffTypes() {
            // arrange
            ManagerLocal ml = managerLocal();
            Guichetier g = guichetier();
            Chauffeur c = chauffeur();

            when(managerLocalRepository.findManagersLocauxByAgenceId(agenceId)).thenReturn(List.of(ml));
            when(guichetierRepository.findGuichetiersByAgenceId(agenceId)).thenReturn(List.of(g));
            when(chauffeurRepository.findChauffeursByAgenceId(agenceId)).thenReturn(List.of(c));

            // act
            List<UserProfile> result = staffQueryService.findAllStaffByAgenceId(agenceId);

            // assert
            assertThat(result)
                    .hasSize(3)
                    .containsExactlyInAnyOrder(ml, g, c);

            verify(managerLocalRepository).findManagersLocauxByAgenceId(agenceId);
            verify(guichetierRepository).findGuichetiersByAgenceId(agenceId);
            verify(chauffeurRepository).findChauffeursByAgenceId(agenceId);
        }

        @Test
        void shouldReturnEmptyList_whenNoStaff() {
            when(managerLocalRepository.findManagersLocauxByAgenceId(agenceId)).thenReturn(List.of());
            when(guichetierRepository.findGuichetiersByAgenceId(agenceId)).thenReturn(List.of());
            when(chauffeurRepository.findChauffeursByAgenceId(agenceId)).thenReturn(List.of());

            List<UserProfile> result = staffQueryService.findAllStaffByAgenceId(agenceId);

            assertThat(result).isEmpty();
        }
    }

    // ─────────────────────────────────────────────
    // findAllManagerLocauxByAgenceId
    // ─────────────────────────────────────────────
    @Nested
    class FindAllManagerLocauxByAgenceId {

        @Test
        void shouldReturnManagerLocauxOnly() {
            ManagerLocal ml = managerLocal();

            when(managerLocalRepository.findManagersLocauxByAgenceId(agenceId))
                    .thenReturn(List.of(ml));

            List<ManagerLocal> result =
                    staffQueryService.findAllManagerLocauxByAgenceId(agenceId);

            assertThat(result)
                    .hasSize(1)
                    .containsExactly(ml);

            verifyNoInteractions(guichetierRepository, chauffeurRepository);
        }
    }

    // ─────────────────────────────────────────────
    // findAllEmployesByAgenceId
    // ─────────────────────────────────────────────
    @Nested
    class FindAllEmployesByAgenceId {

        @Test
        void shouldReturnOnlyEmployes() {
            Guichetier g = guichetier();
            Chauffeur c = chauffeur();

            when(guichetierRepository.findGuichetiersByAgenceId(agenceId)).thenReturn(List.of(g));
            when(chauffeurRepository.findChauffeursByAgenceId(agenceId)).thenReturn(List.of(c));

            List<UserProfile> result =
                    staffQueryService.findAllEmployesByAgenceId(agenceId);

            assertThat(result)
                    .hasSize(2)
                    .containsExactlyInAnyOrder(g, c);

            verify(managerLocalRepository, never())
                    .findManagersLocauxByAgenceId(any());
        }
    }

    // ─────────────────────────────────────────────
    // findAllEmployesByAgenceAndFiliale
    // ─────────────────────────────────────────────
    @Nested
    class FindAllEmployesByAgenceAndFiliale {

        @Test
        void shouldReturnEmployesForAgenceAndFiliale() {
            Guichetier g = guichetier();
            Chauffeur c = chauffeur();

            when(guichetierRepository.findGuichetiersByAgenceAndFiliale(agenceId, filialeId))
                    .thenReturn(List.of(g));
            when(chauffeurRepository.findChauffeursByAgenceAndFiliale(agenceId, filialeId))
                    .thenReturn(List.of(c));

            List<UserProfile> result =
                    staffQueryService.findAllEmployesByAgenceAndFiliale(agenceId, filialeId);

            assertThat(result)
                    .hasSize(2)
                    .containsExactlyInAnyOrder(g, c);
        }
    }

    // ─────────────────────────────────────────────
    // findAllEmployesByFilialeId
    // ─────────────────────────────────────────────
    @Nested
    class FindAllEmployesByFilialeId {

        @Test
        void shouldReturnEmployes() {
            Guichetier g = guichetier();
            Chauffeur c = chauffeur();

            when(guichetierRepository.findGuichetiersByFilialeId(filialeId)).thenReturn(List.of(g));
            when(chauffeurRepository.findChauffeursByFilialeId(filialeId)).thenReturn(List.of(c));

            List<UserProfile> result =
                    staffQueryService.findAllEmployesByFilialeId(filialeId);

            assertThat(result)
                    .hasSize(2)
                    .containsExactlyInAnyOrder(g, c);
        }

        @Test
        void shouldReturnEmpty_whenNoEmployes() {
            when(guichetierRepository.findGuichetiersByFilialeId(filialeId)).thenReturn(List.of());
            when(chauffeurRepository.findChauffeursByFilialeId(filialeId)).thenReturn(List.of());

            List<UserProfile> result =
                    staffQueryService.findAllEmployesByFilialeId(filialeId);

            assertThat(result).isEmpty();
        }
    }

    // ─────────────────────────────────────────────
    // findChauffeursDisponiblesByFiliale
    // ─────────────────────────────────────────────
    @Nested
    class FindChauffeursDisponiblesByFiliale {

        @Test
        void shouldReturnAvailableDrivers() {
            Chauffeur c = chauffeur();

            when(chauffeurRepository.findChauffeursDisponiblesByFiliale(filialeId))
                    .thenReturn(List.of(c));

            List<Chauffeur> result =
                    staffQueryService.findChauffeursDisponiblesByFiliale(filialeId);

            assertThat(result)
                    .hasSize(1)
                    .containsExactly(c)
                    .allMatch(Chauffeur::getDisponible);
        }

        @Test
        void shouldReturnEmpty_whenNoneAvailable() {
            when(chauffeurRepository.findChauffeursDisponiblesByFiliale(filialeId))
                    .thenReturn(List.of());

            List<Chauffeur> result =
                    staffQueryService.findChauffeursDisponiblesByFiliale(filialeId);

            assertThat(result).isEmpty();
        }
    }
}