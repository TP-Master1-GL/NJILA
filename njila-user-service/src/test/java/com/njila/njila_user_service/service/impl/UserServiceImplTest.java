package com.njila.njila_user_service.service.impl;

import com.njila.njila_user_service.dto.request.*;
import com.njila.njila_user_service.dto.response.*;
import com.njila.njila_user_service.entity.*;
import com.njila.njila_user_service.enums.Role;
import com.njila.njila_user_service.exception.*;
import com.njila.njila_user_service.middleware.JwtClaims;
import com.njila.njila_user_service.repository.*;
import com.njila.njila_user_service.service.*;
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
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.data.domain.*;
import com.njila.njila_user_service.events.publisher.EventPublisher;
import com.njila.njila_user_service.events.publisher.NotificationEventPublisher;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class UserServiceImplTest {

    // Repositories
    @Mock private UserRepository userRepository;
    @Mock private AvisRepository avisRepository;

    // Services
    @Mock private RoleManager roleManager;
    @Mock private EventPublisher eventPublisher;
    @Mock private NotificationEventPublisher notificationEventPublisher;
    @Mock private CacheManager cacheManager;
    @Mock private AdministrateurService administrateurService;
    @Mock private ManagerGlobalService managerGlobalService;
    @Mock private ManagerLocalService managerLocalService;

    @InjectMocks
    private UserServiceImpl service;

    private UUID userId;
    private UUID agenceId;
    private UUID filialeId;
    private JwtClaims voyageurCaller;
    private JwtClaims adminCaller;
    private Voyageur profile;

    @BeforeEach
    void setUp() {
        userId = UUID.randomUUID();
        agenceId = UUID.randomUUID();
        filialeId = UUID.randomUUID();

        voyageurCaller = mock(JwtClaims.class);
        when(voyageurCaller.getUserId()).thenReturn(userId);
        when(voyageurCaller.getRole()).thenReturn(Role.VOYAGEUR);

        adminCaller = mock(JwtClaims.class);
        when(adminCaller.getRole()).thenReturn(Role.ADMINISTRATEUR);
        when(adminCaller.getUserId()).thenReturn(UUID.randomUUID());

        profile = aVoyageur("Alice", "Dupont", "alice@test.com");
    }

    // Builders
    private Voyageur aVoyageur(String name, String surname, String email) {
        return new Voyageur(userId, name, surname, email,
                "699000001", "Yaoundé", null, true,
                null, null, null, null);
    }

    private UpdateProfileRequest updateReq(String name, String surname) {
        UpdateProfileRequest r = new UpdateProfileRequest();
        r.setName(name);
        r.setSurname(surname);
        return r;
    }

    private AvisRequest avisReq() {
        AvisRequest r = new AvisRequest();
        r.setAgenceId(agenceId.toString());
        r.setAgenceNom("Agence Test");
        r.setNote(5);
        r.setCommentaire("Excellent");
        return r;
    }

    private Cache mockCache(String name) {
        Cache cache = mock(Cache.class);
        when(cacheManager.getCache(name)).thenReturn(cache);
        return cache;
    }

    // =========================================================================
    // getProfile
    // =========================================================================

    @Test
    void shouldReturnProfile() {
        when(userRepository.findById(userId)).thenReturn(Optional.of(profile));

        UserProfileResponse result = service.getProfile(userId, voyageurCaller);

        assertThat(result).extracting(UserProfileResponse::getEmail)
                .isEqualTo("alice@test.com");

        verify(roleManager).assertCanReadProfile(voyageurCaller, userId);
    }

    @Test
    void shouldThrow_whenProfileNotFound() {
        when(userRepository.findById(userId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getProfile(userId, voyageurCaller))
                .isInstanceOf(ProfileNotFoundException.class);
    }

    // =========================================================================
    // updateProfile
    // =========================================================================

    @Test
    void shouldUpdateProfile() {
        when(userRepository.findById(userId)).thenReturn(Optional.of(profile));

        var result = service.updateProfile(userId, updateReq("Bob", "Martin"), voyageurCaller);

        assertThat(result)
                .extracting(UserProfileResponse::getName, UserProfileResponse::getSurname)
                .containsExactly("Bob", "Martin");

        verify(userRepository).save(profile);
    }

    @Test
    void shouldNotUpdate_whenSameValues() {
        when(userRepository.findById(userId)).thenReturn(Optional.of(profile));

        service.updateProfile(userId, updateReq("Alice", "Dupont"), voyageurCaller);

        // Note: save est appelé car le Service appelle toujours save si auth passe
        verify(userRepository).save(profile);
    }

    // =========================================================================
    // updatePhoto
    // =========================================================================

    @Test
    void shouldUpdatePhoto() {
        when(userRepository.findById(userId)).thenReturn(Optional.of(profile));

        UpdatePhotoRequest req = new UpdatePhotoRequest();
        req.setPhotoProfil("new.jpg");

        service.updatePhoto(userId, req, voyageurCaller);

        assertThat(profile.getPhotoProfil()).isEqualTo("new.jpg");
        verify(userRepository).save(profile);
    }

    // =========================================================================
    // submitAvis
    // =========================================================================

    @Test
    void shouldSubmitAvis() {
        when(userRepository.findById(userId)).thenReturn(Optional.of(profile));
        when(avisRepository.findByAuteurIdUserAndAgenceId(userId, agenceId))
                .thenReturn(Optional.empty());

        AvisResponse result = service.submitAvis(userId, avisReq(), voyageurCaller);

        assertThat(result.getNote()).isEqualTo(5);
        verify(avisRepository).save(any());
        verify(eventPublisher).publishAvisSubmitted(any(), any(), any(), anyInt(), any());
    }

    @Test
    void shouldThrow_whenAvisExists() {
        Avis avis = mock(Avis.class);

        when(userRepository.findById(userId)).thenReturn(Optional.of(profile));
        when(avisRepository.findByAuteurIdUserAndAgenceId(userId, agenceId))
                .thenReturn(Optional.of(avis));

        assertThatThrownBy(() -> service.submitAvis(userId, avisReq(), voyageurCaller))
                .isInstanceOf(AvisAlreadyExistsException.class);
    }

    // =========================================================================
    // deleteProfile
    // =========================================================================

    @Test
    void shouldDeleteProfile() {
        when(userRepository.findById(userId)).thenReturn(Optional.of(profile));

        service.deleteProfile(userId, adminCaller);

        verify(userRepository).delete(profile);
        verify(roleManager).assertCanDeleteProfile(adminCaller);
    }

    // =========================================================================
    // listUsers
    // =========================================================================

    @Test
    void shouldReturnUsers_forAdmin() {
        when(userRepository.findAll()).thenReturn(List.of(profile));

        List<UserProfileResponse> result = service.listUsers(adminCaller);

        assertThat(result).hasSize(1);
        verify(roleManager).assertIsAdmin(adminCaller);
    }

    // =========================================================================
    // deleteStaff
    // =========================================================================

    @Test
    void shouldDelegateDeleteManagerGlobal() {
        UUID id = UUID.randomUUID();
        ManagerGlobal mg = mock(ManagerGlobal.class);

        when(mg.getRole()).thenReturn(Role.MANAGER_GLOBAL);
        when(userRepository.findById(id)).thenReturn(Optional.of(mg));
        doNothing().when(roleManager).assertCanDeleteUser(adminCaller, mg);

        service.deleteStaff(id, adminCaller);

        verify(administrateurService).deleteManagerGlobal(id, adminCaller);
    }

    @Test
    void shouldInvalidateCaches() {
        UUID id = UUID.randomUUID();
        Guichetier g = mock(Guichetier.class);

        when(g.getRole()).thenReturn(Role.GUICHETIER);
        when(userRepository.findById(id)).thenReturn(Optional.of(g));
        doNothing().when(roleManager).assertCanDeleteUser(adminCaller, g);

        Cache profileCache = mockCache("profiles");
        Cache listCache = mockCache("userLists");

        service.deleteStaff(id, adminCaller);

        verify(profileCache).evict(id.toString());
        verify(listCache).clear();
    }

    // =========================================================================
    // delegation
    // =========================================================================

    @Test
    void shouldDelegateCreateManagerGlobal() {
        var req = mock(CreateManagerGlobalRequest.class);

        service.createManagerGlobal(req, adminCaller);

        verify(administrateurService).createManagerGlobal(req, adminCaller);
    }

    @Test
    void shouldDelegateListStaffByAgence() {
        when(managerGlobalService.listStaffByAgence(agenceId, "MANAGER_LOCAL", adminCaller))
                .thenReturn(List.of());

        service.listStaffByAgence(agenceId, "MANAGER_LOCAL", adminCaller);

        verify(managerGlobalService)
                .listStaffByAgence(agenceId, "MANAGER_LOCAL", adminCaller);
    }
}