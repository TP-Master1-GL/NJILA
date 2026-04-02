package com.njila.njila_user_service.service.impl;

import com.njila.njila_user_service.dto.request.*;
import com.njila.njila_user_service.dto.response.*;
import com.njila.njila_user_service.entity.*;
import com.njila.njila_user_service.enums.Role;
import com.njila.njila_user_service.enums.UserEventType;
import com.njila.njila_user_service.events.publisher.EventPublisher;
import com.njila.njila_user_service.exception.*;
import com.njila.njila_user_service.middleware.JwtClaims;
import com.njila.njila_user_service.observer.IUserObserver;
import com.njila.njila_user_service.observer.UserEvent;
import com.njila.njila_user_service.repository.*;
import com.njila.njila_user_service.service.RedisCacheInvalidator;
import com.njila.njila_user_service.service.RoleManager;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.data.domain.*;

import java.util.*;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("UserServiceImpl — Tests unitaires v1.4")
class UserServiceImplTest {

    @Mock UserRepository        userRepository;
    @Mock AvisRepository        avisRepository;
    @Mock AgenceRepository      agenceRepository;
    @Mock FilialeRepository     filialeRepository;
    @Mock RoleManager           roleManager;
    @Mock EventPublisher        eventPublisher;
    @Mock RedisCacheInvalidator cacheInvalidator;
    @Mock RabbitTemplate        rabbitTemplate;

    @InjectMocks UserServiceImpl service;

    private static final UUID USER_ID    = UUID.fromString("eb4fc6e3-6d17-4543-8610-fde8509f5ca2");
    private static final UUID ADMIN_ID   = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final UUID AGENCE_ID  = UUID.fromString("a0000000-0000-0000-0000-000000000001");
    private static final UUID FILIALE_ID = UUID.fromString("f0000000-0000-0000-0000-000000000001");
    private static final UUID AVIS_ID    = UUID.fromString("b0000000-0000-0000-0000-000000000001");

    private JwtClaims callerVoyageur;
    private JwtClaims callerAdmin;
    private JwtClaims callerManager;
    private UserProfile voyageurProfile;

    @BeforeEach
    void setUp() {
        callerVoyageur = JwtClaims.builder().userId(USER_ID).role(Role.VOYAGEUR).build();
        callerAdmin    = JwtClaims.builder().userId(ADMIN_ID).role(Role.ADMINISTRATEUR).build();
        callerManager  = JwtClaims.builder().userId(ADMIN_ID).role(Role.MANAGER_LOCAL)
                           .filialeId(FILIALE_ID).agenceId(AGENCE_ID).build();
        voyageurProfile = UserProfile.builder()
            .idUser(USER_ID).name("Jean").surname("Dupont")
            .email("jean.dupont@njila.cm").phone("+237699000001")
            .role(Role.VOYAGEUR).isActive(true).build();
        service.subscribe(eventPublisher);
        service.subscribe(cacheInvalidator);
    }

    // ── getProfile ──────────────────────────────────────────────────────────

    @Test @DisplayName("getProfile: succes retourne profil complet")
    void getProfile_success() {
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(voyageurProfile));
        UserProfileResponse r = service.getProfile(USER_ID, callerVoyageur);
        assertThat(r.getIdUser()).isEqualTo(USER_ID);
        assertThat(r.getName()).isEqualTo("Jean");
        assertThat(r.getRole()).isEqualTo(Role.VOYAGEUR);
        verify(roleManager).assertCanReadProfile(callerVoyageur, USER_ID);
    }

    @Test @DisplayName("getProfile: 404 profil introuvable")
    void getProfile_notFound() {
        when(userRepository.findById(USER_ID)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.getProfile(USER_ID, callerVoyageur))
            .isInstanceOf(ProfileNotFoundException.class)
            .hasMessageContaining(USER_ID.toString());
    }

    @Test @DisplayName("getProfile: 403 acces refuse")
    void getProfile_forbidden() {
        doThrow(new ForbiddenException("Interdit")).when(roleManager).assertCanReadProfile(callerVoyageur, USER_ID);
        assertThatThrownBy(() -> service.getProfile(USER_ID, callerVoyageur))
            .isInstanceOf(ForbiddenException.class);
        verify(userRepository, never()).findById(any());
    }

    // ── updateProfile ───────────────────────────────────────────────────────

    @Test @DisplayName("updateProfile: tous les champs mis a jour")
    void updateProfile_allFields() {
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(voyageurProfile));
        when(userRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        UpdateProfileRequest req = new UpdateProfileRequest();
        req.setName("Marie"); req.setSurname("Martin");
        req.setPhone("+237699000099"); req.setAdresse("Yaoundé");
        UserProfileResponse r = service.updateProfile(USER_ID, req, callerVoyageur);
        assertThat(r.getName()).isEqualTo("Marie");
        assertThat(r.getSurname()).isEqualTo("Martin");
        assertThat(r.getPhone()).isEqualTo("+237699000099");
    }

    @Test @DisplayName("updateProfile: champs null ignores (PATCH partiel)")
    void updateProfile_partial() {
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(voyageurProfile));
        when(userRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        UpdateProfileRequest req = new UpdateProfileRequest();
        req.setPhone("+237699000002");
        UserProfileResponse r = service.updateProfile(USER_ID, req, callerVoyageur);
        assertThat(r.getName()).isEqualTo("Jean");
        assertThat(r.getPhone()).isEqualTo("+237699000002");
    }

    @Test @DisplayName("updateProfile: name blank ignore")
    void updateProfile_blankNameIgnored() {
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(voyageurProfile));
        when(userRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        UpdateProfileRequest req = new UpdateProfileRequest();
        req.setName("   ");
        UserProfileResponse r = service.updateProfile(USER_ID, req, callerVoyageur);
        assertThat(r.getName()).isEqualTo("Jean");
    }

    @Test @DisplayName("updateProfile: observers notifies")
    void updateProfile_notifiesObservers() {
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(voyageurProfile));
        when(userRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        UpdateProfileRequest req = new UpdateProfileRequest();
        req.setName("Nouveau");
        service.updateProfile(USER_ID, req, callerVoyageur);
        verify(eventPublisher).onUserEvent(argThat(e -> e.getEventType() == UserEventType.PROFIL_MODIFIER));
        verify(cacheInvalidator).onUserEvent(any(UserEvent.class));
    }

    @Test @DisplayName("updateProfile: 404")
    void updateProfile_notFound() {
        when(userRepository.findById(USER_ID)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.updateProfile(USER_ID, new UpdateProfileRequest(), callerVoyageur))
            .isInstanceOf(ProfileNotFoundException.class);
    }

    @Test @DisplayName("updateProfile: 403")
    void updateProfile_forbidden() {
        doThrow(new ForbiddenException("Non autorise")).when(roleManager).assertCanUpdateProfile(callerVoyageur, USER_ID);
        assertThatThrownBy(() -> service.updateProfile(USER_ID, new UpdateProfileRequest(), callerVoyageur))
            .isInstanceOf(ForbiddenException.class);
        verify(userRepository, never()).findById(any());
    }

    // ── updatePhoto ─────────────────────────────────────────────────────────

    @Test @DisplayName("updatePhoto: photo mise a jour et event publie vers auth")
    void updatePhoto_success() {
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(voyageurProfile));
        when(userRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        UpdatePhotoRequest req = new UpdatePhotoRequest();
        req.setPhotoProfil("https://cdn.njila.cm/jean.jpg");
        UserProfileResponse r = service.updatePhoto(USER_ID, req, callerVoyageur);
        assertThat(r.getPhotoProfil()).isEqualTo("https://cdn.njila.cm/jean.jpg");
        verify(userRepository).save(any(UserProfile.class));
        verify(eventPublisher).publishPhotoUpdated(USER_ID.toString(), "https://cdn.njila.cm/jean.jpg");
    }

    @Test @DisplayName("updatePhoto: 404 profil introuvable")
    void updatePhoto_notFound() {
        when(userRepository.findById(USER_ID)).thenReturn(Optional.empty());
        UpdatePhotoRequest req = new UpdatePhotoRequest();
        req.setPhotoProfil("https://cdn.njila.cm/photo.jpg");
        assertThatThrownBy(() -> service.updatePhoto(USER_ID, req, callerVoyageur))
            .isInstanceOf(ProfileNotFoundException.class);
        verify(eventPublisher, never()).publishPhotoUpdated(any(), any());
    }

    // ── deleteProfile ────────────────────────────────────────────────────────

    @Test @DisplayName("deleteProfile: admin supprime succes")
    void deleteProfile_adminSuccess() {
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(voyageurProfile));
        assertThatNoException().isThrownBy(() -> service.deleteProfile(USER_ID, callerAdmin));
        verify(userRepository).delete(voyageurProfile);
        verify(eventPublisher).onUserEvent(argThat(e -> e.getEventType() == UserEventType.COMPTE_SUPPRIMER));
    }

    @Test @DisplayName("deleteProfile: 403 non admin")
    void deleteProfile_forbidden() {
        doThrow(new ForbiddenException("Admin uniquement")).when(roleManager).assertCanDeleteProfile(callerVoyageur);
        assertThatThrownBy(() -> service.deleteProfile(USER_ID, callerVoyageur))
            .isInstanceOf(ForbiddenException.class);
        verify(userRepository, never()).delete(any());
    }

    @Test @DisplayName("deleteProfile: 404")
    void deleteProfile_notFound() {
        when(userRepository.findById(USER_ID)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.deleteProfile(USER_ID, callerAdmin))
            .isInstanceOf(ProfileNotFoundException.class);
    }

    // ── listUsers ────────────────────────────────────────────────────────────

    @Test @DisplayName("listUsers: retourne tous les profils")
    void listUsers_success() {
        when(userRepository.findAll()).thenReturn(List.of(voyageurProfile));
        List<UserProfileResponse> result = service.listUsers(callerAdmin);
        assertThat(result).hasSize(1);
        assertThat(result.get(0).getName()).isEqualTo("Jean");
    }

    @Test @DisplayName("listUsers: liste vide")
    void listUsers_empty() {
        when(userRepository.findAll()).thenReturn(Collections.emptyList());
        assertThat(service.listUsers(callerAdmin)).isEmpty();
    }

    @Test @DisplayName("listUsers: 403 voyageur")
    void listUsers_forbidden() {
        doThrow(new ForbiddenException("Interdit")).when(roleManager).assertCanListUsers(callerVoyageur);
        assertThatThrownBy(() -> service.listUsers(callerVoyageur)).isInstanceOf(ForbiddenException.class);
        verify(userRepository, never()).findAll();
    }

    // ── createStaff ──────────────────────────────────────────────────────────

    private CreateStaffRequest staffReq(String email, Role role) {
        CreateStaffRequest r = new CreateStaffRequest();
        r.setName("Paul"); r.setSurname("Biya"); r.setEmail(email);
        r.setPhone("+237677000001"); r.setRole(role);
        r.setAgenceId(AGENCE_ID.toString()); r.setFilialeId(FILIALE_ID.toString());
        r.setPoste("Agent");
        return r;
    }

    @Test @DisplayName("createStaff: succes guichetier cree en BD et event publie")
    void createStaff_success() {
        when(userRepository.existsByEmail("paul@njila.cm")).thenReturn(false);
        when(agenceRepository.existsById(AGENCE_ID)).thenReturn(true);
        when(filialeRepository.existsById(FILIALE_ID)).thenReturn(true);
        when(userRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        UserProfileResponse r = service.createStaff(staffReq("paul@njila.cm", Role.GUICHETIER), callerManager);
        assertThat(r.getRole()).isEqualTo(Role.GUICHETIER);
        assertThat(r.getEmail()).isEqualTo("paul@njila.cm");
        verify(userRepository).save(any());
        verify(rabbitTemplate).convertAndSend(eq("njila.user.exchange"), eq("staff.created"), any(Object.class));
    }

    @Test @DisplayName("createStaff: email normalise en minuscules")
    void createStaff_emailNormalized() {
        when(userRepository.existsByEmail("paul@njila.cm")).thenReturn(false);
        when(agenceRepository.existsById(AGENCE_ID)).thenReturn(true);
        when(filialeRepository.existsById(FILIALE_ID)).thenReturn(true);
        when(userRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        UserProfileResponse r = service.createStaff(staffReq("PAUL@NJILA.CM", Role.GUICHETIER), callerManager);
        assertThat(r.getEmail()).isEqualTo("paul@njila.cm");
    }

    @Test @DisplayName("createStaff: 409 email deja existant")
    void createStaff_emailConflict() {
        when(userRepository.existsByEmail("paul@njila.cm")).thenReturn(true);
        assertThatThrownBy(() -> service.createStaff(staffReq("paul@njila.cm", Role.GUICHETIER), callerManager))
            .isInstanceOf(EmailAlreadyExistsException.class);
        verify(userRepository, never()).save(any());
    }

    @Test @DisplayName("createStaff: 404 agence introuvable")
    void createStaff_agenceNotFound() {
        when(userRepository.existsByEmail(anyString())).thenReturn(false);
        when(agenceRepository.existsById(AGENCE_ID)).thenReturn(false);
        assertThatThrownBy(() -> service.createStaff(staffReq("new@njila.cm", Role.GUICHETIER), callerManager))
            .isInstanceOf(AgenceNotFoundException.class);
        verify(userRepository, never()).save(any());
    }

    @Test @DisplayName("createStaff: 404 filiale introuvable")
    void createStaff_filialeNotFound() {
        when(userRepository.existsByEmail(anyString())).thenReturn(false);
        when(agenceRepository.existsById(AGENCE_ID)).thenReturn(true);
        when(filialeRepository.existsById(FILIALE_ID)).thenReturn(false);
        assertThatThrownBy(() -> service.createStaff(staffReq("new@njila.cm", Role.GUICHETIER), callerManager))
            .isInstanceOf(FilialeNotFoundException.class);
        verify(userRepository, never()).save(any());
    }

    @Test @DisplayName("createStaff: 403 voyageur interdit")
    void createStaff_forbidden() {
        doThrow(new ForbiddenException("Interdit")).when(roleManager).assertCanCreateStaff(callerVoyageur);
        assertThatThrownBy(() -> service.createStaff(staffReq("new@njila.cm", Role.GUICHETIER), callerVoyageur))
            .isInstanceOf(ForbiddenException.class);
        verify(userRepository, never()).existsByEmail(any());
    }

    @Test @DisplayName("createStaff: erreur RabbitMQ non bloquante — profil quand meme cree")
    void createStaff_rabbitMqErrorNonBlocking() {
        when(userRepository.existsByEmail(anyString())).thenReturn(false);
        when(agenceRepository.existsById(AGENCE_ID)).thenReturn(true);
        when(filialeRepository.existsById(FILIALE_ID)).thenReturn(true);
        when(userRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        doThrow(new RuntimeException("RabbitMQ down"))
            .when(rabbitTemplate).convertAndSend(anyString(), anyString(), any(Object.class));
        assertThatNoException().isThrownBy(() ->
            service.createStaff(staffReq("ok@njila.cm", Role.GUICHETIER), callerManager));
        verify(userRepository).save(any());
    }

    // ── submitAvis ───────────────────────────────────────────────────────────

    private AvisRequest avisReq(int note) {
        AvisRequest r = new AvisRequest();
        r.setAgenceId(AGENCE_ID.toString()); r.setAgenceNom("Agence Express");
        r.setNote(note); r.setCommentaire("Commentaire test");
        return r;
    }

    private Avis buildAvis(int note) {
        return Avis.builder().id(AVIS_ID).auteur(voyageurProfile)
            .agenceId(AGENCE_ID).agenceNom("Agence Express")
            .note(note).commentaire("Commentaire test").visible(true).build();
    }

    @Test @DisplayName("submitAvis: succes")
    void submitAvis_success() {
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(voyageurProfile));
        when(avisRepository.findByAuteurIdUserAndAgenceId(USER_ID, AGENCE_ID)).thenReturn(Optional.empty());
        when(avisRepository.save(any())).thenReturn(buildAvis(4));
        AvisResponse r = service.submitAvis(USER_ID, avisReq(4), callerVoyageur);
        assertThat(r.getNote()).isEqualTo(4);
        assertThat(r.getAuteurName()).isEqualTo("Jean");
        verify(eventPublisher).publishAvisSubmitted(anyString(), anyString(), anyString(), eq(4), anyString());
    }

    @Test @DisplayName("submitAvis: 409 avis deja soumis")
    void submitAvis_duplicate() {
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(voyageurProfile));
        when(avisRepository.findByAuteurIdUserAndAgenceId(USER_ID, AGENCE_ID))
            .thenReturn(Optional.of(buildAvis(3)));
        assertThatThrownBy(() -> service.submitAvis(USER_ID, avisReq(3), callerVoyageur))
            .isInstanceOf(AvisAlreadyExistsException.class);
        verify(avisRepository, never()).save(any());
    }

    @Test @DisplayName("submitAvis: 403 non-voyageur")
    void submitAvis_notVoyageur() {
        doThrow(new ForbiddenException("Voyageur uniquement")).when(roleManager).assertCanSubmitAvis(callerAdmin);
        assertThatThrownBy(() -> service.submitAvis(USER_ID, avisReq(3), callerAdmin))
            .isInstanceOf(ForbiddenException.class);
    }

    @Test @DisplayName("submitAvis: 403 mauvais userId")
    void submitAvis_wrongUser() {
        JwtClaims other = JwtClaims.builder().userId(UUID.randomUUID()).role(Role.VOYAGEUR).build();
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(voyageurProfile));
        assertThatThrownBy(() -> service.submitAvis(USER_ID, avisReq(3), other))
            .isInstanceOf(ForbiddenException.class);
    }

    @Test @DisplayName("submitAvis: 404 profil introuvable")
    void submitAvis_profileNotFound() {
        when(userRepository.findById(USER_ID)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.submitAvis(USER_ID, avisReq(3), callerVoyageur))
            .isInstanceOf(ProfileNotFoundException.class);
    }

    // ── getUserAvis ──────────────────────────────────────────────────────────

    @Test @DisplayName("getUserAvis: retourne liste des avis")
    void getUserAvis_success() {
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(voyageurProfile));
        when(avisRepository.findAllByAuteurIdUser(USER_ID)).thenReturn(List.of(buildAvis(4)));
        List<AvisResponse> result = service.getUserAvis(USER_ID, callerVoyageur);
        assertThat(result).hasSize(1);
        assertThat(result.get(0).getNote()).isEqualTo(4);
    }

    @Test @DisplayName("getUserAvis: liste vide")
    void getUserAvis_empty() {
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(voyageurProfile));
        when(avisRepository.findAllByAuteurIdUser(USER_ID)).thenReturn(Collections.emptyList());
        assertThat(service.getUserAvis(USER_ID, callerVoyageur)).isEmpty();
    }

    @Test @DisplayName("getUserAvis: 404")
    void getUserAvis_notFound() {
        when(userRepository.findById(USER_ID)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.getUserAvis(USER_ID, callerVoyageur))
            .isInstanceOf(ProfileNotFoundException.class);
    }

    // ── getAgenceAvis ─────────────────────────────────────────────────────────

    @Test @DisplayName("getAgenceAvis: retourne page d avis")
    void getAgenceAvis_success() {
        Page<Avis> page = new PageImpl<>(List.of(buildAvis(5)));
        when(avisRepository.findAllByAgenceIdAndVisibleTrue(eq(AGENCE_ID), any())).thenReturn(page);
        Page<AvisResponse> result = service.getAgenceAvis(AGENCE_ID, PageRequest.of(0, 10));
        assertThat(result.getContent()).hasSize(1);
        assertThat(result.getContent().get(0).getNote()).isEqualTo(5);
    }

    @Test @DisplayName("getAgenceAvis: page vide")
    void getAgenceAvis_empty() {
        when(avisRepository.findAllByAgenceIdAndVisibleTrue(any(), any())).thenReturn(Page.empty());
        assertThat(service.getAgenceAvis(AGENCE_ID, PageRequest.of(0, 10)).getContent()).isEmpty();
    }

    // ── deleteAvis ───────────────────────────────────────────────────────────

    @Test @DisplayName("deleteAvis: auteur supprime son avis")
    void deleteAvis_byAuthor() {
        when(avisRepository.findById(AVIS_ID)).thenReturn(Optional.of(buildAvis(3)));
        assertThatNoException().isThrownBy(() -> service.deleteAvis(USER_ID, AVIS_ID, callerVoyageur));
        verify(avisRepository).delete(any(Avis.class));
    }

    @Test @DisplayName("deleteAvis: admin supprime n importe quel avis")
    void deleteAvis_byAdmin() {
        when(avisRepository.findById(AVIS_ID)).thenReturn(Optional.of(buildAvis(3)));
        assertThatNoException().isThrownBy(() -> service.deleteAvis(USER_ID, AVIS_ID, callerAdmin));
        verify(avisRepository).delete(any(Avis.class));
    }

    @Test @DisplayName("deleteAvis: 403 autre utilisateur interdit")
    void deleteAvis_forbidden() {
        when(avisRepository.findById(AVIS_ID)).thenReturn(Optional.of(buildAvis(3)));
        doThrow(new ForbiddenException("Non autorise")).when(roleManager).assertCanDeleteAvis(any(), eq(USER_ID));
        JwtClaims other = JwtClaims.builder().userId(UUID.randomUUID()).role(Role.VOYAGEUR).build();
        assertThatThrownBy(() -> service.deleteAvis(USER_ID, AVIS_ID, other))
            .isInstanceOf(ForbiddenException.class);
        verify(avisRepository, never()).delete(any());
    }

    @Test @DisplayName("deleteAvis: 404 avis introuvable")
    void deleteAvis_notFound() {
        when(avisRepository.findById(AVIS_ID)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.deleteAvis(USER_ID, AVIS_ID, callerVoyageur))
            .isInstanceOf(ProfileNotFoundException.class);
    }

    // ── getNoteMoyenne ────────────────────────────────────────────────────────

    @Test @DisplayName("getNoteMoyenne: 4.25 arrondi a 4.3")
    void getNoteMoyenne_rounded() {
        when(avisRepository.getNoteMoyenneByAgenceId(AGENCE_ID)).thenReturn(4.25);
        assertThat(service.getNoteMoyenne(AGENCE_ID)).isEqualTo(4.3);
    }

    @Test @DisplayName("getNoteMoyenne: null retourne 0.0")
    void getNoteMoyenne_null() {
        when(avisRepository.getNoteMoyenneByAgenceId(AGENCE_ID)).thenReturn(null);
        assertThat(service.getNoteMoyenne(AGENCE_ID)).isEqualTo(0.0);
    }

    @Test @DisplayName("getNoteMoyenne: note entiere conservee")
    void getNoteMoyenne_exact() {
        when(avisRepository.getNoteMoyenneByAgenceId(AGENCE_ID)).thenReturn(4.0);
        assertThat(service.getNoteMoyenne(AGENCE_ID)).isEqualTo(4.0);
    }

    // ── Observer ──────────────────────────────────────────────────────────────

    @Test @DisplayName("Observer: subscribe ajoute l observateur")
    void observer_subscribe() {
        IUserObserver newObs = mock(IUserObserver.class);
        service.subscribe(newObs);
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(voyageurProfile));
        when(userRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        UpdateProfileRequest req = new UpdateProfileRequest();
        req.setName("Test");
        service.updateProfile(USER_ID, req, callerVoyageur);
        verify(newObs).onUserEvent(any());
    }

    @Test @DisplayName("Observer: unsubscribe retire l observateur")
    void observer_unsubscribe() {
        IUserObserver tempObs = mock(IUserObserver.class);
        service.subscribe(tempObs);
        service.unsubscribe(tempObs);
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(voyageurProfile));
        when(userRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        UpdateProfileRequest req = new UpdateProfileRequest();
        req.setName("Test");
        service.updateProfile(USER_ID, req, callerVoyageur);
        verify(tempObs, never()).onUserEvent(any());
    }

    @Test @DisplayName("Observer: erreur d un observer non propagee")
    void observer_errorDoesNotPropagate() {
        doThrow(new RuntimeException("Observer crash")).when(eventPublisher).onUserEvent(any());
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(voyageurProfile));
        when(userRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        UpdateProfileRequest req = new UpdateProfileRequest();
        req.setName("Test");
        assertThatNoException().isThrownBy(() -> service.updateProfile(USER_ID, req, callerVoyageur));
        verify(cacheInvalidator).onUserEvent(any());
    }
}