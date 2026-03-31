package com.njila.njila_user_service.service.impl;

import com.njila.njila_user_service.dto.request.AvisRequest;
import com.njila.njila_user_service.dto.request.UpdateProfileRequest;
import com.njila.njila_user_service.dto.response.AvisResponse;
import com.njila.njila_user_service.dto.response.UserProfileResponse;
import com.njila.njila_user_service.entity.Avis;
import com.njila.njila_user_service.entity.UserProfile;
import com.njila.njila_user_service.enums.Role;
import com.njila.njila_user_service.events.publisher.EventPublisher;
import com.njila.njila_user_service.exception.*;
import com.njila.njila_user_service.middleware.JwtClaims;
import com.njila.njila_user_service.repository.AvisRepository;
import com.njila.njila_user_service.repository.UserRepository;
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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("UserServiceImpl — Tests unitaires")
class UserServiceImplTest {

    @Mock UserRepository        userRepository;
    @Mock AvisRepository        avisRepository;
    @Mock RoleManager           roleManager;
    @Mock EventPublisher        eventPublisher;
    @Mock RedisCacheInvalidator cacheInvalidator;
    @Mock RabbitTemplate        rabbitTemplate;

    @InjectMocks UserServiceImpl userService;

    private static final UUID USER_ID   = UUID.randomUUID();
    private static final UUID ADMIN_ID  = UUID.randomUUID();
    private static final UUID AGENCE_ID = UUID.randomUUID();
    private static final UUID AVIS_ID   = UUID.randomUUID();

    private JwtClaims callerVoyageur;
    private JwtClaims callerAdmin;
    private UserProfile voyageurProfile;

    @BeforeEach
    void setUp() {
        callerVoyageur = JwtClaims.builder().userId(USER_ID).role(Role.VOYAGEUR).build();
        callerAdmin    = JwtClaims.builder().userId(ADMIN_ID).role(Role.ADMINISTRATEUR).build();

        voyageurProfile = UserProfile.builder()
            .idUser(USER_ID)
            .name("Jean")
            .surname("Dupont")
            .email("jean@njila.cm")
            .phone("+237600000001")
            .role(Role.VOYAGEUR)
            .isActive(true)
            .build();

        userService.subscribe(eventPublisher);
        userService.subscribe(cacheInvalidator);
    }

    // ── GET PROFILE ──────────────────────────────────────────────────────────

    @Nested @DisplayName("getProfile()")
    class GetProfileTests {

        @Test @DisplayName("Succès — profil retourné")
        void success() {
            when(userRepository.findById(USER_ID)).thenReturn(Optional.of(voyageurProfile));
            UserProfileResponse r = userService.getProfile(USER_ID, callerVoyageur);
            assertThat(r.getIdUser()).isEqualTo(USER_ID);
            assertThat(r.getName()).isEqualTo("Jean");
            assertThat(r.getSurname()).isEqualTo("Dupont");
        }

        @Test @DisplayName("404 — profil introuvable")
        void notFound() {
            when(userRepository.findById(USER_ID)).thenReturn(Optional.empty());
            assertThatThrownBy(() -> userService.getProfile(USER_ID, callerVoyageur))
                .isInstanceOf(ProfileNotFoundException.class);
        }

        @Test @DisplayName("403 — accès refusé")
        void forbidden() {
            doThrow(new ForbiddenException("Interdit"))
                .when(roleManager).assertCanReadProfile(callerVoyageur, USER_ID);
            assertThatThrownBy(() -> userService.getProfile(USER_ID, callerVoyageur))
                .isInstanceOf(ForbiddenException.class);
            verify(userRepository, never()).findById(any());
        }
    }

    // ── UPDATE PROFILE ───────────────────────────────────────────────────────

    @Nested @DisplayName("updateProfile()")
    class UpdateProfileTests {

        @Test @DisplayName("Succès — tous les champs mis à jour")
        void success() {
            when(userRepository.findById(USER_ID)).thenReturn(Optional.of(voyageurProfile));
            when(userRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            UpdateProfileRequest req = new UpdateProfileRequest();
            req.setName("Marie");
            req.setSurname("Martin");
            req.setPhone("+237699000001");
            req.setAdresse("Rue de la Paix, Yaoundé");

            UserProfileResponse r = userService.updateProfile(USER_ID, req, callerVoyageur);
            assertThat(r.getName()).isEqualTo("Marie");
            assertThat(r.getSurname()).isEqualTo("Martin");
            verify(userRepository).save(any());
        }

        @Test @DisplayName("PATCH partiel — champ null ignoré")
        void partialUpdate() {
            when(userRepository.findById(USER_ID)).thenReturn(Optional.of(voyageurProfile));
            when(userRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            UpdateProfileRequest req = new UpdateProfileRequest();
            req.setPhone("+237699000002");

            UserProfileResponse r = userService.updateProfile(USER_ID, req, callerVoyageur);
            assertThat(r.getName()).isEqualTo("Jean");      // inchangé
            assertThat(r.getPhone()).isEqualTo("+237699000002");
        }

        @Test @DisplayName("Observateurs notifiés")
        void notifiesObservers() {
            when(userRepository.findById(USER_ID)).thenReturn(Optional.of(voyageurProfile));
            when(userRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            UpdateProfileRequest req = new UpdateProfileRequest();
            req.setName("Nouveau");

            userService.updateProfile(USER_ID, req, callerVoyageur);
            verify(eventPublisher).onUserEvent(any());
            verify(cacheInvalidator).onUserEvent(any());
        }
    }

    // ── DELETE PROFILE ───────────────────────────────────────────────────────

    @Nested @DisplayName("deleteProfile()")
    class DeleteProfileTests {

        @Test @DisplayName("Admin peut supprimer")
        void success() {
            when(userRepository.findById(USER_ID)).thenReturn(Optional.of(voyageurProfile));
            assertThatNoException()
                .isThrownBy(() -> userService.deleteProfile(USER_ID, callerAdmin));
            verify(userRepository).delete(voyageurProfile);
        }

        @Test @DisplayName("403 — non admin rejeté")
        void forbidden() {
            doThrow(new ForbiddenException("Admin uniquement"))
                .when(roleManager).assertCanDeleteProfile(callerVoyageur);
            assertThatThrownBy(() -> userService.deleteProfile(USER_ID, callerVoyageur))
                .isInstanceOf(ForbiddenException.class);
            verify(userRepository, never()).delete(any());
        }
    }

    // ── SUBMIT AVIS ──────────────────────────────────────────────────────────

    @Nested @DisplayName("submitAvis()")
    class SubmitAvisTests {

        private AvisRequest req;

        @BeforeEach
        void setup() {
            req = new AvisRequest();
            req.setAgenceId(AGENCE_ID.toString());
            req.setAgenceNom("Agence Express");
            req.setNote(4);
            req.setCommentaire("Très bon service !");
        }

        @Test @DisplayName("Succès — avis sauvegardé")
        void success() {
            when(userRepository.findById(USER_ID)).thenReturn(Optional.of(voyageurProfile));
            when(avisRepository.findByAuteurIdUserAndAgenceId(USER_ID, AGENCE_ID))
                .thenReturn(Optional.empty());

            Avis saved = Avis.builder()
                .id(AVIS_ID).auteur(voyageurProfile)
                .agenceId(AGENCE_ID).agenceNom("Agence Express")
                .note(4).commentaire("Très bon service !").visible(true)
                .build();
            when(avisRepository.save(any())).thenReturn(saved);

            AvisResponse r = userService.submitAvis(USER_ID, req, callerVoyageur);
            assertThat(r.getNote()).isEqualTo(4);
            assertThat(r.getAgenceId()).isEqualTo(AGENCE_ID);
        }

        @Test @DisplayName("409 — avis déjà existant")
        void alreadyExists() {
            when(userRepository.findById(USER_ID)).thenReturn(Optional.of(voyageurProfile));
            when(avisRepository.findByAuteurIdUserAndAgenceId(USER_ID, AGENCE_ID))
                .thenReturn(Optional.of(Avis.builder().id(UUID.randomUUID()).build()));

            assertThatThrownBy(() -> userService.submitAvis(USER_ID, req, callerVoyageur))
                .isInstanceOf(AvisAlreadyExistsException.class);
            verify(avisRepository, never()).save(any());
        }

        @Test @DisplayName("403 — non-voyageur rejeté")
        void notVoyageur() {
            doThrow(new ForbiddenException("Voyageur uniquement"))
                .when(roleManager).assertCanSubmitAvis(callerAdmin);
            assertThatThrownBy(() -> userService.submitAvis(USER_ID, req, callerAdmin))
                .isInstanceOf(ForbiddenException.class);
        }

        @Test @DisplayName("Note moyenne arrondie à 1 décimale")
        void noteMoyenne() {
            when(avisRepository.getNoteMoyenneByAgenceId(AGENCE_ID)).thenReturn(4.25);
            assertThat(userService.getNoteMoyenne(AGENCE_ID)).isEqualTo(4.3);
        }

        @Test @DisplayName("Note moyenne = 0.0 si aucun avis")
        void noteMoyenneEmpty() {
            when(avisRepository.getNoteMoyenneByAgenceId(AGENCE_ID)).thenReturn(null);
            assertThat(userService.getNoteMoyenne(AGENCE_ID)).isEqualTo(0.0);
        }
    }

    // ── DELETE AVIS ──────────────────────────────────────────────────────────

    @Nested @DisplayName("deleteAvis()")
    class DeleteAvisTests {

        @Test @DisplayName("Auteur peut supprimer son avis")
        void byAuthor() {
            Avis avis = Avis.builder().id(AVIS_ID).auteur(voyageurProfile)
                .agenceId(AGENCE_ID).note(3).build();
            when(avisRepository.findById(AVIS_ID)).thenReturn(Optional.of(avis));
            assertThatNoException()
                .isThrownBy(() -> userService.deleteAvis(USER_ID, AVIS_ID, callerVoyageur));
            verify(avisRepository).delete(avis);
        }

        @Test @DisplayName("404 — avis introuvable")
        void notFound() {
            when(avisRepository.findById(AVIS_ID)).thenReturn(Optional.empty());
            assertThatThrownBy(() -> userService.deleteAvis(USER_ID, AVIS_ID, callerVoyageur))
                .isInstanceOf(ProfileNotFoundException.class);
        }
    }

    // ── GET AVIS AGENCE ──────────────────────────────────────────────────────

    @Nested @DisplayName("getAgenceAvis()")
    class GetAgenceAvisTests {

        @Test @DisplayName("Retourne une page d'avis")
        void returnPage() {
            Avis avis = Avis.builder().id(UUID.randomUUID()).auteur(voyageurProfile)
                .agenceId(AGENCE_ID).note(5).visible(true).build();
            when(avisRepository.findAllByAgenceIdAndVisibleTrue(any(), any()))
                .thenReturn(new PageImpl<>(List.of(avis)));

            Page<AvisResponse> result =
                userService.getAgenceAvis(AGENCE_ID, PageRequest.of(0, 10));
            assertThat(result.getContent()).hasSize(1);
            assertThat(result.getContent().get(0).getNote()).isEqualTo(5);
        }

        @Test @DisplayName("Retourne page vide si aucun avis")
        void emptyPage() {
            when(avisRepository.findAllByAgenceIdAndVisibleTrue(any(), any()))
                .thenReturn(Page.empty());
            assertThat(userService.getAgenceAvis(AGENCE_ID, PageRequest.of(0, 10))
                .getContent()).isEmpty();
        }
    }
}