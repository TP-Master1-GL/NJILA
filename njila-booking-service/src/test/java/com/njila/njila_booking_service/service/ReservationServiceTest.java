package com.njila.njila_booking_service.service;

import com.njila.njila_booking_service.domain.entity.*;
import com.njila.njila_booking_service.domain.entity.projection.*;
import com.njila.njila_booking_service.domain.enums.*;
import com.njila.njila_booking_service.dto.request.CreerReservationRequest;
import com.njila.njila_booking_service.dto.response.RecettesResponse;
import com.njila.njila_booking_service.dto.response.ReservationStatsResponse;
import com.njila.njila_booking_service.dto.response.VoyagePassagersResponse;
import com.njila.njila_booking_service.messaging.publisher.BookingEventPublisher;
import com.njila.njila_booking_service.repository.*;
import com.njila.njila_booking_service.repository.projection.*;
import com.njila.njila_booking_service.service.factory.TicketElectroniqueFactory;
import com.njila.njila_booking_service.service.factory.TicketEmbarquementFactory;
import com.njila.njila_booking_service.service.pricing.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("ReservationService Tests")
class ReservationServiceTest {

    @Mock private ReservationRepository reservationRepository;
    @Mock private TicketRepository ticketRepository;
    @Mock private PaiementRepository paiementRepository;
    @Mock private HistoriqueReservationRepository historiqueRepository;
    @Mock private PlaceReserveeRepository placeReserveeRepository;
    @Mock private SeatLockManager seatLockManager;
    @Mock private TicketNumberGenerator ticketNumberGenerator;
    @Mock private PdfGeneratorService pdfGeneratorService;
    @Mock private BookingEventPublisher eventPublisher;

    @Mock private VoyageDataRepository voyageDataRepository;
    @Mock private UserDataRepository userDataRepository;
    @Mock private AgenceDataRepository agenceDataRepository;
    @Mock private FilialeDataRepository filialeDataRepository;
    @Mock private BusDataRepository busDataRepository;

    @Mock private TicketElectroniqueFactory ticketElectroniqueFactory;
    @Mock private TicketEmbarquementFactory ticketEmbarquementFactory;
    @Mock private FideliteService fideliteService;
    @Mock private PrixStandardStrategy prixStandard;
    @Mock private PrixGroupeStrategy prixGroupe;
    @Mock private PrixPromoStrategy prixPromo;

    @InjectMocks
    private ReservationService reservationService;

    private VoyageData voyageData;
    private UserData userData;
    private Reservation reservation;
    private AgenceData agenceData;

    @BeforeEach
    void setUp() {
        voyageData = VoyageData.builder()
                .id("voyage-1")
                .prix(5000.0)
                .origine("Yaoundé")
                .destination("Douala")
                .dateHeureDepart(LocalDateTime.parse("2026-05-23T08:00:00"))
                .immatriculationBus("LT-1234-A")
                .placesDisponibles(70)
                .capaciteBus(70)
                .build();

        userData = UserData.builder()
                .id("user-1")
                .nom("NGUEMBU")
                .prenom("John")
                .email("john@njila.cm")
                .telephone("+237699000001")
                .role("VOYAGEUR")
                .adresse("Yaoundé")
                .photoUrl("")
                .build();

        agenceData = AgenceData.builder()
                .id("GEN")
                .nom("Général")
                .logoUrl("http://logo.url")
                .build();

        reservation = Reservation.builder()
                .idVoyage("voyage-1")
                .idVoyageur("user-1")
                .nombrePlaces(1)
                .canal(CanalReservation.WEB)
                .codeAgence("GEN")
                .codeFiliale("BYDE")
                .statut(StatutReservation.EN_ATTENTE)
                .montantTotal(5000.0)
                .devise("XAF")
                .dateReservation(LocalDateTime.now())
                .tickets(new ArrayList<>())
                .placesReservees(new ArrayList<>())
                .historique(new ArrayList<>())
                .build();
    }

    private void stubSiegesLibres() {
        when(reservationRepository.findSiegesOccupes("voyage-1",
                StatutReservation.ANNULEE, StatutReservation.EXPIREE))
                .thenReturn(Set.of());
        when(seatLockManager.getSiegesVerrouilles("voyage-1"))
                .thenReturn(Set.of());
    }

    // ═════════════════════════════════════════════════════════════════════════
    // CRÉER UNE RÉSERVATION
    // ═════════════════════════════════════════════════════════════════════════

    @Test
    @DisplayName("Créer réservation WEB standard - succès")
    void creerReservation_web_standard_succes() {
        reservation.setId(1L);

        when(voyageDataRepository.findById("voyage-1")).thenReturn(Optional.of(voyageData));
        stubSiegesLibres();
        when(userDataRepository.findById("user-1")).thenReturn(Optional.of(userData));
        when(seatLockManager.acquerirVerrouSieges(eq("voyage-1"), eq("user-1"), anyList()))
                .thenReturn(true);
        when(reservationRepository.save(any())).thenReturn(reservation);
        when(prixStandard.calculerPrix(any(), eq(5000.0), eq(1))).thenReturn(5000.0);
        when(historiqueRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        Reservation result = reservationService.creerReservation(
                "voyage-1", "user-1",
                "NGUEMBU", "John", "+237699000001", "john@njila.cm",
                1, CanalReservation.WEB,
                "GEN", "BYDE", null,
                CreerReservationRequest.TypeTarif.STANDARD, null,
                null, "XAF", "MOBILE_MONEY", null, "ORANGE_MONEY");

        assertThat(result).isNotNull();
        assertThat(result.getId()).isEqualTo(1L);
        assertThat(result.getStatut()).isEqualTo(StatutReservation.EN_ATTENTE);
        assertThat(result.getCanal()).isEqualTo(CanalReservation.WEB);
        verify(eventPublisher).publierBookingCreated(
                eq(1L), eq(5000.0), eq("XAF"), eq("user-1"), eq("voyage-1"),
                anyString(), anyString(), anyString());
        verify(seatLockManager).acquerirVerrouSieges(
                eq("voyage-1"), eq("user-1"), anyList());
    }

    @Test
    @DisplayName("Créer réservation - places insuffisantes")
    void creerReservation_placesInsuffisantes_leveException() {
        voyageData.setPlacesDisponibles(2);
        when(voyageDataRepository.findById("voyage-1")).thenReturn(Optional.of(voyageData));

        assertThatThrownBy(() ->
                reservationService.creerReservation(
                        "voyage-1", "user-1",
                        "NGUEMBU", "John", null, null,
                        3, CanalReservation.WEB,
                        "GEN", "BYDE", null,
                        CreerReservationRequest.TypeTarif.STANDARD, null,
                        null, "XAF", null, null, null))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Places insuffisantes");

        verify(seatLockManager, never()).acquerirVerrouSieges(any(), any(), any());
    }

    @Test
    @DisplayName("Créer réservation - siège déjà verrouillé")
    void creerReservation_siegeDejaVerrouille_leveException() {
        // FIX : dans le service, l'ordre réel est :
        //   1. attribuerSieges (findSiegesOccupes + getSiegesVerrouilles)
        //   2. resolverVoyageur
        //   3. acquerirVerrouSieges → false
        //   4. reservationRepository.save(saved)   ← save APRÈS l'acquis du verrou
        //   => save n'est jamais appelé, donc delete non plus.
        //
        // Le service lève l'exception AVANT le save quand acquerirVerrouSieges
        // retourne false. Il ne faut donc PAS vérifier delete(reservation).
        // On vérifie uniquement que l'exception est bien levée et que
        // libererSieges n'est pas appelé (les verrous n'ont jamais été pris).

        when(voyageDataRepository.findById("voyage-1")).thenReturn(Optional.of(voyageData));
        stubSiegesLibres();
        when(userDataRepository.findById("user-1")).thenReturn(Optional.of(userData));
        when(seatLockManager.acquerirVerrouSieges(any(), any(), any())).thenReturn(false);

        assertThatThrownBy(() ->
                reservationService.creerReservation(
                        "voyage-1", "user-1",
                        "NGUEMBU", "John", null, null,
                        1, CanalReservation.WEB,
                        "GEN", "BYDE", null,
                        CreerReservationRequest.TypeTarif.STANDARD, null,
                        null, "XAF", null, null, null))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("sièges demandés viennent d'être réservés");

        // Le verrou n'ayant jamais été acquis, aucun siège à libérer
        verify(seatLockManager, never()).libererSieges(any(), any());
        // Aucun save n'a eu lieu, donc aucun delete possible
        verify(reservationRepository, never()).delete(any(Reservation.class));
    }

    @Test
    @DisplayName("Créer réservation - siège spécifique demandé")
    void creerReservation_siegeSpecifiqueDemande_utiliseLeNumeroExact() {
        reservation.setId(1L);

        when(voyageDataRepository.findById("voyage-1")).thenReturn(Optional.of(voyageData));
        stubSiegesLibres();
        when(userDataRepository.findById("user-1")).thenReturn(Optional.of(userData));
        when(seatLockManager.acquerirVerrouSieges(
                eq("voyage-1"), eq("user-1"), eq(List.of(15))))
                .thenReturn(true);
        when(reservationRepository.save(any())).thenReturn(reservation);
        when(prixStandard.calculerPrix(any(), anyDouble(), anyInt())).thenReturn(5000.0);
        when(historiqueRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        reservationService.creerReservation(
                "voyage-1", "user-1",
                "NGUEMBU", "John", null, null,
                1, CanalReservation.WEB,
                "GEN", "BYDE", null,
                CreerReservationRequest.TypeTarif.STANDARD, null,
                List.of(15), "XAF", null, null, null);

        verify(seatLockManager).acquerirVerrouSieges(
                "voyage-1", "user-1", List.of(15));
    }

    @Test
    @DisplayName("Créer réservation - siège demandé occupé en DB")
    void creerReservation_siegeDemandeOccupeEnDB_leveException() {
        when(voyageDataRepository.findById("voyage-1")).thenReturn(Optional.of(voyageData));
        when(reservationRepository.findSiegesOccupes("voyage-1",
                StatutReservation.ANNULEE, StatutReservation.EXPIREE))
                .thenReturn(Set.of(5));
        when(seatLockManager.getSiegesVerrouilles("voyage-1")).thenReturn(Set.of());

        assertThatThrownBy(() ->
                reservationService.creerReservation(
                        "voyage-1", "user-1",
                        "NGUEMBU", "John", null, null,
                        1, CanalReservation.WEB,
                        "GEN", "BYDE", null,
                        CreerReservationRequest.TypeTarif.STANDARD, null,
                        List.of(5), "XAF", null, null, null))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("déjà réservé");
    }

    @Test
    @DisplayName("Créer réservation - tarif groupe")
    void creerReservation_tarifGroupe_utiliseStrategieGroupe() {
        CreerReservationRequest.MembreGroupeRequest membre1 = new CreerReservationRequest.MembreGroupeRequest();
        membre1.setNom("DUPONT");
        membre1.setPrenom("Jean");
        membre1.setTelephone("+237699000002");
        membre1.setABagage(true);

        CreerReservationRequest.MembreGroupeRequest membre2 = new CreerReservationRequest.MembreGroupeRequest();
        membre2.setNom("MARTIN");
        membre2.setPrenom("Paul");
        membre2.setTelephone("+237699000003");
        membre2.setABagage(false);

        List<CreerReservationRequest.MembreGroupeRequest> membres = List.of(membre1, membre2);

        reservation.setId(1L);
        reservation.setNombrePlaces(3);

        when(voyageDataRepository.findById("voyage-1")).thenReturn(Optional.of(voyageData));
        stubSiegesLibres();
        when(userDataRepository.findById("user-1")).thenReturn(Optional.of(userData));
        when(seatLockManager.acquerirVerrouSieges(any(), any(), any())).thenReturn(true);
        when(reservationRepository.save(any())).thenReturn(reservation);
        when(prixGroupe.calculerPrix(any(), eq(5000.0), eq(3))).thenReturn(14000.0);
        when(historiqueRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        reservationService.creerReservation(
                "voyage-1", "user-1",
                "NGUEMBU", "John", "+237699000001", "john@njila.cm",
                3, CanalReservation.WEB,
                "GEN", "BYDE", null,
                CreerReservationRequest.TypeTarif.GROUPE, membres,
                null, "XAF", null, null, null);

        assertThat(reservation.getNombrePlaces()).isEqualTo(3);
        assertThat(reservation.getPlacesReservees()).hasSize(3);
        verify(prixGroupe).calculerPrix(any(), eq(5000.0), eq(3));
    }

    @Test
    @DisplayName("Créer réservation au guichet - confirmée directement")
    void creerReservation_guichet_confirmeDirectement() {
        reservation.setId(1L);
        reservation.setCanal(CanalReservation.GUICHET);
        PlaceReservee place = PlaceReservee.builder()
                .numeroSiege(1)
                .reservation(reservation)
                .nomPassager("NGUEMBU John")
                .telephonePassager("+237699000001")
                .estResponsable(true)
                .prixUnitaire(5000.0)
                .build();
        reservation.getPlacesReservees().add(place);

        when(voyageDataRepository.findById("voyage-1")).thenReturn(Optional.of(voyageData));
        stubSiegesLibres();
        when(userDataRepository.findById("user-1")).thenReturn(Optional.of(userData));
        when(seatLockManager.acquerirVerrouSieges(any(), any(), any())).thenReturn(true);
        when(reservationRepository.save(any())).thenReturn(reservation);
        when(prixStandard.calculerPrix(any(), anyDouble(), anyInt())).thenReturn(5000.0);
        when(historiqueRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(ticketNumberGenerator.genererBilletEmbarquement("GEN", "BYDE"))
                .thenReturn("GEN-EMB-20260523-BYDE-000001");
        when(agenceDataRepository.findById("GEN")).thenReturn(Optional.of(agenceData));

        TicketEmbarquement ticketEmb = new TicketEmbarquement();
        ticketEmb.setNumeroTicket("GEN-EMB-20260523-BYDE-000001");
        ticketEmb.setNumeroPlace("1");
        when(ticketEmbarquementFactory.creerTicket(
                any(), any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(ticketEmb);
        when(ticketRepository.save(any())).thenReturn(ticketEmb);

        reservationService.creerReservation(
                "voyage-1", "user-1",
                "NGUEMBU", "John", "+237699000001", "john@njila.cm",
                1, CanalReservation.GUICHET,
                "GEN", "BYDE", "guichet-1",
                CreerReservationRequest.TypeTarif.STANDARD, null,
                null, "XAF", null, null, null);

        // Canal GUICHET → pas d'événement booking.created
        verify(eventPublisher, never()).publierBookingCreated(
                any(), any(), any(), any(), any(), any(), any(), any());
        // Billet généré immédiatement
        verify(ticketRepository).save(any());
        verify(fideliteService).incrementer("user-1", "GEN");
        verify(seatLockManager).libererSieges(eq("voyage-1"), anyList());
    }

    // ═════════════════════════════════════════════════════════════════════════
    // CONFIRMER APRÈS PAIEMENT EN LIGNE
    // ═════════════════════════════════════════════════════════════════════════

    @Test
    @DisplayName("Confirmer après paiement en ligne - succès")
    void confirmerApresPaiement_passeLaReservationEnPayee() {
        reservation.setId(1L);
        PlaceReservee place = PlaceReservee.builder()
                .numeroSiege(7)
                .reservation(reservation)
                .nomPassager("NGUEMBU John")
                .estResponsable(true)
                .build();
        reservation.getPlacesReservees().add(place);

        when(reservationRepository.findById(1L)).thenReturn(Optional.of(reservation));
        when(reservationRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(paiementRepository.findByReservationId(1L)).thenReturn(Optional.empty());
        when(voyageDataRepository.findById("voyage-1")).thenReturn(Optional.of(voyageData));
        when(userDataRepository.findById("user-1")).thenReturn(Optional.of(userData));
        when(ticketNumberGenerator.genererBilletElectronique("GEN", "BYDE"))
                .thenReturn("GEN-WEB-20260523-BYDE-000001");
        when(agenceDataRepository.findById("GEN")).thenReturn(Optional.of(agenceData));

        TicketElectronique ticketElec = new TicketElectronique();
        ticketElec.setId(1L);
        ticketElec.setNumeroTicket("GEN-WEB-20260523-BYDE-000001");
        ticketElec.setDateDepart(LocalDate.of(2026, 5, 23));
        ticketElec.setStatut(StatutTicket.ACTIF);
        ticketElec.setConverti(false);
        ticketElec.setUtilise(false);
        when(ticketElectroniqueFactory.creerTicket(
                any(), any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(ticketElec);
        when(pdfGeneratorService.genererBilletElectronique(any()))
                .thenReturn(new byte[]{1, 2, 3});
        when(ticketRepository.save(any())).thenReturn(ticketElec);
        when(historiqueRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        reservationService.confirmerApresPaiement(1L, "TXN-001");

        assertThat(reservation.getStatut()).isEqualTo(StatutReservation.PAYEE);
        verify(fideliteService).incrementer("user-1", "GEN");
        verify(seatLockManager).libererSieges("voyage-1", List.of(7));
        verify(eventPublisher).publierTicketGenerated(
                eq("user-1"), eq("john@njila.cm"), anyString(),
                eq("GEN-WEB-20260523-BYDE-000001"),
                eq("Yaoundé"), eq("Douala"), anyString());
    }

    @Test
    @DisplayName("Confirmer après paiement - réservation déjà payée")
    void confirmerApresPaiement_reservationDejaPayee_ignoree() {
        reservation.setId(1L);
        reservation.setStatut(StatutReservation.PAYEE);

        when(reservationRepository.findById(1L)).thenReturn(Optional.of(reservation));

        reservationService.confirmerApresPaiement(1L, "TXN-001");

        verify(fideliteService, never()).incrementer(any(), any());
        verify(eventPublisher, never()).publierTicketGenerated(
                any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("Confirmer après paiement - réservation introuvable")
    void confirmerApresPaiement_reservationIntrouvable_leveException() {
        when(reservationRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() ->
                reservationService.confirmerApresPaiement(99L, "TXN-001"))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("introuvable");
    }

    @Test
    @DisplayName("Confirmer après paiement - mauvais statut")
    void confirmerApresPaiement_mauvaisStatut_leveException() {
        reservation.setId(1L);
        reservation.setStatut(StatutReservation.CONFIRMEE);

        when(reservationRepository.findById(1L)).thenReturn(Optional.of(reservation));

        assertThatThrownBy(() ->
                reservationService.confirmerApresPaiement(1L, "TXN-001"))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("EN_ATTENTE");
    }

    // ═════════════════════════════════════════════════════════════════════════
    // SUPPRIMER APRÈS ÉCHEC PAIEMENT
    // ═════════════════════════════════════════════════════════════════════════

    @Test
    @DisplayName("Supprimer après échec paiement - succès")
    void supprimerApresEchecPaiement_libereSiegesEtSupprime() {
        reservation.setId(1L);
        PlaceReservee place = PlaceReservee.builder()
                .numeroSiege(9)
                .reservation(reservation)
                .build();
        reservation.getPlacesReservees().add(place);

        when(reservationRepository.findById(1L)).thenReturn(Optional.of(reservation));
        when(paiementRepository.findByReservationId(1L)).thenReturn(Optional.empty());

        reservationService.supprimerApresEchecPaiement(1L, "Timeout paiement");

        verify(reservationRepository).delete(reservation);
        verify(seatLockManager).libererSieges("voyage-1", List.of(9));
        verify(placeReserveeRepository).deleteByReservationId(1L);
        verify(historiqueRepository).deleteByReservationId(1L);
    }

    @Test
    @DisplayName("Supprimer après échec - réservation déjà annulée")
    void supprimerApresEchecPaiement_dejaAnnulee_ignoree() {
        reservation.setId(1L);
        reservation.setStatut(StatutReservation.ANNULEE);

        when(reservationRepository.findById(1L)).thenReturn(Optional.of(reservation));

        reservationService.supprimerApresEchecPaiement(1L, "Motif");

        verify(reservationRepository, never()).delete(any());
    }

    @Test
    @DisplayName("Supprimer après échec - statut non EN_ATTENTE")
    void supprimerApresEchecPaiement_statutNonEnAttente_ignoree() {
        reservation.setId(1L);
        reservation.setStatut(StatutReservation.PAYEE);

        when(reservationRepository.findById(1L)).thenReturn(Optional.of(reservation));

        reservationService.supprimerApresEchecPaiement(1L, "Motif");

        verify(reservationRepository, never()).delete(any());
    }

    // ═════════════════════════════════════════════════════════════════════════
    // EXPIRER LES RÉSERVATIONS EN ATTENTE
    // ═════════════════════════════════════════════════════════════════════════

    @Test
    @DisplayName("Expirer réservations - supprime les expirees")
    void expirerReservationsEnAttente_supprimeLesExpirees() {
        Reservation r1 = buildReservation();
        r1.setId(1L);
        PlaceReservee place = PlaceReservee.builder()
                .numeroSiege(5)
                .reservation(r1)
                .build();
        r1.getPlacesReservees().add(place);

        // FIX : tous les arguments doivent être des matchers Mockito.
        // Mélanger une valeur concrète (StatutReservation.EN_ATTENTE) avec any()
        // provoque "Invalid use of argument matchers!".
        // On utilise eq() pour les valeurs concrètes.
        when(reservationRepository.findByStatutAndCanalAndDateReservationBefore(
                eq(StatutReservation.EN_ATTENTE),
                eq(CanalReservation.WEB),
                any(LocalDateTime.class)))
                .thenReturn(List.of(r1));

        reservationService.expirerReservationsEnAttente();

        verify(placeReserveeRepository).deleteByReservationId(1L);
        verify(historiqueRepository).deleteByReservationId(1L);
        verify(reservationRepository).delete(r1);
        verify(seatLockManager).libererSieges("voyage-1", List.of(5));
    }

    @Test
    @DisplayName("Expirer réservations - aucune à expirer")
    void expirerReservationsEnAttente_aucuneAExpirer() {
        // FIX : cohérence matchers — tout en any() ou tout en eq()
        when(reservationRepository.findByStatutAndCanalAndDateReservationBefore(
                any(), any(), any()))
                .thenReturn(List.of());

        reservationService.expirerReservationsEnAttente();

        verify(reservationRepository, never()).delete(any());
    }

    // ═════════════════════════════════════════════════════════════════════════
    // ANNULER PAR L'UTILISATEUR
    // ═════════════════════════════════════════════════════════════════════════

    @Test
    @DisplayName("Annuler réservation - payée, publie remboursement")
    void annulerReservation_etaitPayee_publieRemboursement() {
        reservation.setId(1L);
        reservation.setStatut(StatutReservation.PAYEE);
        reservation.setMontantTotal(5000.0);
        PlaceReservee place = PlaceReservee.builder()
                .numeroSiege(12)
                .reservation(reservation)
                .build();
        reservation.getPlacesReservees().add(place);

        when(reservationRepository.findById(1L)).thenReturn(Optional.of(reservation));
        when(reservationRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(paiementRepository.findByReservationId(1L)).thenReturn(Optional.empty());
        when(historiqueRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        reservationService.annulerReservation(1L, "user-1");

        assertThat(reservation.getStatut()).isEqualTo(StatutReservation.ANNULEE);
        verify(seatLockManager).libererSieges("voyage-1", List.of(12));
        verify(eventPublisher).publierRemboursementDemande(
                eq(1L), eq("user-1"), eq(5000.0), eq("XAF"), anyString());
    }

    @Test
    @DisplayName("Annuler réservation - en attente, aucun remboursement")
    void annulerReservation_enAttente_aucunRemboursement() {
        reservation.setId(1L);
        reservation.setStatut(StatutReservation.EN_ATTENTE);
        PlaceReservee place = PlaceReservee.builder()
                .numeroSiege(4)
                .reservation(reservation)
                .build();
        reservation.getPlacesReservees().add(place);

        when(reservationRepository.findById(1L)).thenReturn(Optional.of(reservation));
        when(reservationRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(paiementRepository.findByReservationId(1L)).thenReturn(Optional.empty());
        when(historiqueRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        reservationService.annulerReservation(1L, "user-1");

        verify(seatLockManager).libererSieges("voyage-1", List.of(4));
        verify(eventPublisher, never()).publierRemboursementDemande(
                any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("Annuler réservation - embarquée")
    void annulerReservation_dejaEmbarquee_leveException() {
        reservation.setId(1L);
        reservation.setStatut(StatutReservation.EMBARQUEE);

        when(reservationRepository.findById(1L)).thenReturn(Optional.of(reservation));

        assertThatThrownBy(() ->
                reservationService.annulerReservation(1L, "user-1"))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("embarquée");

        verify(seatLockManager, never()).libererSieges(any(), any());
    }

    @Test
    @DisplayName("Annuler réservation - déjà annulée")
    void annulerReservation_dejaAnnulee_leveException() {
        reservation.setId(1L);
        reservation.setStatut(StatutReservation.ANNULEE);

        when(reservationRepository.findById(1L)).thenReturn(Optional.of(reservation));

        assertThatThrownBy(() ->
                reservationService.annulerReservation(1L, "user-1"))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("déjà annulée");
    }

    // ═════════════════════════════════════════════════════════════════════════
    // CONVERTIR BILLET ÉLECTRONIQUE → EMBARQUEMENT
    // ═════════════════════════════════════════════════════════════════════════

    @Test
    @DisplayName("Convertir billet électronique - succès")
    void convertirBilletElectronique_genereEmbarquement() {
        reservation.setId(1L);
        reservation.setStatut(StatutReservation.PAYEE);
        PlaceReservee placeResp = PlaceReservee.builder()
                .numeroSiege(6)
                .reservation(reservation)
                .estResponsable(true)
                .build();
        reservation.getPlacesReservees().add(placeResp);

        TicketElectronique ticketElec = new TicketElectronique();
        ticketElec.setId(100L);
        ticketElec.setNumeroTicket("GEN-WEB-20260523-BYDE-000001");
        ticketElec.setStatut(StatutTicket.ACTIF);
        ticketElec.setConverti(false);
        ticketElec.setUtilise(false);
        ticketElec.setReservation(reservation);
        ticketElec.setNomVoyageur("NGUEMBU John");
        ticketElec.setTelephoneVoyageur("+237699000001");
        ticketElec.setOrigine("Yaoundé");
        ticketElec.setDestination("Douala");
        ticketElec.setDateDepart(LocalDate.of(2026, 5, 23));
        ticketElec.setImmatriculationBus("LT-1234-A");

        when(ticketRepository.findByNumeroTicket("GEN-WEB-20260523-BYDE-000001"))
                .thenReturn(Optional.of(ticketElec));
        when(ticketRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(ticketNumberGenerator.genererBilletEmbarquement("GEN", "BYDE"))
                .thenReturn("GEN-EMB-20260523-BYDE-000001");
        when(agenceDataRepository.findById("GEN")).thenReturn(Optional.of(agenceData));

        TicketEmbarquement ticketEmb = new TicketEmbarquement();
        ticketEmb.setId(101L);
        ticketEmb.setNumeroTicket("GEN-EMB-20260523-BYDE-000001");
        when(ticketEmbarquementFactory.creerTicket(
                any(), any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(ticketEmb);
        when(reservationRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(historiqueRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        TicketEmbarquement result = reservationService.convertirBilletElectronique(
                "GEN-WEB-20260523-BYDE-000001", "guichet-1");

        assertThat(result).isNotNull();
        assertThat(ticketElec.getConverti()).isTrue();
        assertThat(reservation.getStatut()).isEqualTo(StatutReservation.CONFIRMEE);
        verify(ticketRepository, atLeastOnce()).save(any());
    }

    @Test
    @DisplayName("Convertir billet - introuvable")
    void convertirBilletElectronique_introuvable_leveException() {
        when(ticketRepository.findByNumeroTicket("INVALID")).thenReturn(Optional.empty());

        assertThatThrownBy(() ->
                reservationService.convertirBilletElectronique("INVALID", "guichet-1"))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("introuvable");
    }

    @Test
    @DisplayName("Convertir billet - pas électronique")
    void convertirBilletElectronique_pasElectronique_leveException() {
        TicketEmbarquement ticketEmb = new TicketEmbarquement();
        ticketEmb.setNumeroTicket("GEN-EMB-001");

        when(ticketRepository.findByNumeroTicket("GEN-EMB-001"))
                .thenReturn(Optional.of(ticketEmb));

        assertThatThrownBy(() ->
                reservationService.convertirBilletElectronique("GEN-EMB-001", "guichet-1"))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("électronique");
    }

    // ═════════════════════════════════════════════════════════════════════════
    // VALIDER UN BILLET AU DÉPART
    // ═════════════════════════════════════════════════════════════════════════

    @Test
    @DisplayName("Valider billet au départ - embarquement réussi")
    void validerBilletDepart_marqueEmbarque() {
        reservation.setId(1L);
        reservation.setStatut(StatutReservation.PAYEE);

        TicketEmbarquement ticket = new TicketEmbarquement();
        ticket.setNumeroTicket("GEN-EMB-20260523-BYDE-000001");
        ticket.setStatut(StatutTicket.ACTIF);
        ticket.setUtilise(false);
        ticket.setReservation(reservation);

        when(ticketRepository.findByNumeroTicket("GEN-EMB-20260523-BYDE-000001"))
                .thenReturn(Optional.of(ticket));
        when(ticketRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(reservationRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(historiqueRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        Ticket result = reservationService.validerBilletDepart(
                "GEN-EMB-20260523-BYDE-000001", "manager-1");

        assertThat(result.getStatut()).isEqualTo(StatutTicket.EMBARQUEE);
        assertThat(result.getUtilise()).isTrue();
        assertThat(reservation.getStatut()).isEqualTo(StatutReservation.EMBARQUEE);
    }

    @Test
    @DisplayName("Valider billet - déjà embarqué")
    void validerBilletDepart_dejaEmbarque_leveException() {
        reservation.setStatut(StatutReservation.EMBARQUEE);

        TicketEmbarquement ticket = new TicketEmbarquement();
        ticket.setNumeroTicket("GEN-EMB-001");
        ticket.setStatut(StatutTicket.EMBARQUEE);
        ticket.setReservation(reservation);

        when(ticketRepository.findByNumeroTicket("GEN-EMB-001"))
                .thenReturn(Optional.of(ticket));

        assertThatThrownBy(() ->
                reservationService.validerBilletDepart("GEN-EMB-001", "manager-1"))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("déjà validé");
    }

    @Test
    @DisplayName("Valider billet - électronique non converti")
    void validerBilletDepart_electroniqueNonConverti_leveException() {
        reservation.setStatut(StatutReservation.PAYEE);

        TicketElectronique ticketElec = new TicketElectronique();
        ticketElec.setNumeroTicket("GEN-WEB-001");
        ticketElec.setStatut(StatutTicket.ACTIF);
        ticketElec.setConverti(false);
        ticketElec.setReservation(reservation);

        when(ticketRepository.findByNumeroTicket("GEN-WEB-001"))
                .thenReturn(Optional.of(ticketElec));

        assertThatThrownBy(() ->
                reservationService.validerBilletDepart("GEN-WEB-001", "manager-1"))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("converti");
    }

    // ═════════════════════════════════════════════════════════════════════════
    // CLÔTURER LE DÉPART
    // ═════════════════════════════════════════════════════════════════════════

    @Test
    @DisplayName("Clôturer départ - publie événement")
    void cloturerDepart_publieEvenementDepart() {
        Reservation r1 = buildReservation();
        r1.setStatut(StatutReservation.EMBARQUEE);
        r1.setNombrePlaces(2);

        Reservation r2 = buildReservation();
        r2.setStatut(StatutReservation.CONFIRMEE);
        r2.setNombrePlaces(1);

        Reservation r3 = buildReservation();
        r3.setStatut(StatutReservation.ANNULEE);
        r3.setNombrePlaces(1);

        when(reservationRepository.findByIdVoyage("voyage-1"))
                .thenReturn(List.of(r1, r2, r3));

        Map<String, Object> result =
                reservationService.cloturerDepart("voyage-1", "manager-1");

        assertThat(result.get("voyageId")).isEqualTo("voyage-1");
        assertThat(result.get("passagersEmbarques")).isEqualTo(1L);
        assertThat(result.get("statut")).isEqualTo("DEPART_CLOTURE");
        verify(eventPublisher).publierDepartVoyage(
                eq("voyage-1"), eq("manager-1"), anyInt(), anyInt());
    }

    @Test
    @DisplayName("Clôturer départ - aucune réservation")
    void cloturerDepart_aucuneReservation_leveException() {
        when(reservationRepository.findByIdVoyage("voyage-1"))
                .thenReturn(List.of());

        assertThatThrownBy(() ->
                reservationService.cloturerDepart("voyage-1", "manager-1"))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Aucune réservation");
    }

    // ═════════════════════════════════════════════════════════════════════════
    // PASSAGERS D'UN VOYAGE
    // ═════════════════════════════════════════════════════════════════════════

    @Test
    @DisplayName("Obtenir passagers voyage - manifeste")
    void getPassagersVoyage_retourneManifeste() {
        ReservationRepository.PassagerProjection p1 = mockPassagerProjection(
                1, "NGUEMBU", "John", "1", StatutReservation.PAYEE, 5000.0);
        ReservationRepository.PassagerProjection p2 = mockPassagerProjection(
                2, "DUPONT", "Jean", "2", StatutReservation.CONFIRMEE, 5000.0);

        when(voyageDataRepository.findById("voyage-1")).thenReturn(Optional.of(voyageData));
        when(reservationRepository.findPassagersByVoyage(
                eq("voyage-1"), eq(StatutReservation.ANNULEE), eq(StatutReservation.EXPIREE)))
                .thenReturn(List.of(p1, p2));

        VoyagePassagersResponse result = reservationService.getPassagersVoyage("voyage-1");

        assertThat(result.getVoyageId()).isEqualTo("voyage-1");
        assertThat(result.getCapaciteTotale()).isEqualTo(70);
        assertThat(result.getPlacesOccupees()).isEqualTo(2);
        assertThat(result.getPlacesLibres()).isEqualTo(68);
        assertThat(result.getPassagers()).hasSize(2);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // STATISTIQUES
    // ═════════════════════════════════════════════════════════════════════════

    @Test
    @DisplayName("Obtenir stats filiale - métriques agrégées")
    void getStatsFiliale_retourneMetriques() {
        ReservationRepository.StatutCount sc1 = mockStatutCount(StatutReservation.PAYEE, 10);
        ReservationRepository.StatutCount sc2 = mockStatutCount(StatutReservation.CONFIRMEE, 5);
        ReservationRepository.StatutCount sc3 = mockStatutCount(StatutReservation.ANNULEE, 3);

        when(reservationRepository.countByStatutForFiliale(
                "BYDE", StatutReservation.EN_ATTENTE, StatutReservation.EXPIREE))
                .thenReturn(List.of(sc1, sc2, sc3));
        when(reservationRepository.sumMontantByCodeFiliale(
                eq("BYDE"), eq(StatutReservation.PAYEE),
                eq(StatutReservation.CONFIRMEE), eq(StatutReservation.EMBARQUEE)))
                .thenReturn(75000.0);
        when(reservationRepository.sumPlacesVenduesByCodeFiliale(
                eq("BYDE"), eq(StatutReservation.PAYEE),
                eq(StatutReservation.CONFIRMEE), eq(StatutReservation.EMBARQUEE)))
                .thenReturn(15L);

        ReservationStatsResponse stats = reservationService.getStatsFiliale("BYDE");

        assertThat(stats.getTotalReservations()).isEqualTo(18L);
        assertThat(stats.getReservationsConfirmees()).isEqualTo(15L);
        assertThat(stats.getChiffreAffairesTotal()).isEqualTo(75000.0);
        assertThat(stats.getTotalPlacesVendues()).isEqualTo(15L);
    }

    @Test
    @DisplayName("Obtenir recettes agence - détail par canal")
    void getRecettesAgence_retourneRecettes() {
        ReservationRepository.CanalCount cc1 = mockCanalCount(CanalReservation.WEB, 8);
        ReservationRepository.CanalCount cc2 = mockCanalCount(CanalReservation.GUICHET, 5);

        when(reservationRepository.sumRecetteTotaleByAgence(
                eq("GEN"), eq(StatutReservation.PAYEE),
                eq(StatutReservation.CONFIRMEE), eq(StatutReservation.EMBARQUEE)))
                .thenReturn(65000.0);
        when(reservationRepository.sumRecetteByAgenceAndCanal(
                eq("GEN"), eq(CanalReservation.WEB),
                eq(StatutReservation.PAYEE), eq(StatutReservation.CONFIRMEE),
                eq(StatutReservation.EMBARQUEE)))
                .thenReturn(40000.0);
        when(reservationRepository.sumRecetteByAgenceAndCanal(
                eq("GEN"), eq(CanalReservation.GUICHET),
                eq(StatutReservation.PAYEE), eq(StatutReservation.CONFIRMEE),
                eq(StatutReservation.EMBARQUEE)))
                .thenReturn(25000.0);
        when(reservationRepository.countAndSumByCanal(
                eq("GEN"), eq(StatutReservation.PAYEE),
                eq(StatutReservation.CONFIRMEE), eq(StatutReservation.EMBARQUEE)))
                .thenReturn(List.of(cc1, cc2));

        RecettesResponse result = reservationService.getRecettesAgence("GEN", "XAF");

        assertThat(result.getCode()).isEqualTo("GEN");
        assertThat(result.getRecetteTotale()).isEqualTo(65000.0);
        assertThat(result.getRecetteEnLigne()).isEqualTo(40000.0);
        assertThat(result.getRecetteGuichet()).isEqualTo(25000.0);
    }

    @Test
    @DisplayName("Obtenir recettes filiale - détail par canal")
    void getRecettesFiliale_retourneRecettes() {
        ReservationRepository.CanalCount cc1 = mockCanalCount(CanalReservation.WEB, 6);
        ReservationRepository.CanalCount cc2 = mockCanalCount(CanalReservation.GUICHET, 4);

        when(reservationRepository.sumRecetteTotaleByFiliale(
                eq("BYDE"), eq(StatutReservation.PAYEE),
                eq(StatutReservation.CONFIRMEE), eq(StatutReservation.EMBARQUEE)))
                .thenReturn(50000.0);
        when(reservationRepository.sumRecetteByFilialeAndCanal(
                eq("BYDE"), eq(CanalReservation.WEB),
                eq(StatutReservation.PAYEE), eq(StatutReservation.CONFIRMEE),
                eq(StatutReservation.EMBARQUEE)))
                .thenReturn(30000.0);
        when(reservationRepository.sumRecetteByFilialeAndCanal(
                eq("BYDE"), eq(CanalReservation.GUICHET),
                eq(StatutReservation.PAYEE), eq(StatutReservation.CONFIRMEE),
                eq(StatutReservation.EMBARQUEE)))
                .thenReturn(20000.0);
        when(reservationRepository.countAndSumByCanalForFiliale(
                eq("BYDE"), eq(StatutReservation.PAYEE),
                eq(StatutReservation.CONFIRMEE), eq(StatutReservation.EMBARQUEE)))
                .thenReturn(List.of(cc1, cc2));

        RecettesResponse result = reservationService.getRecettesFiliale("BYDE", "XAF");

        assertThat(result.getCode()).isEqualTo("BYDE");
        assertThat(result.getTypeEntite()).isEqualTo("FILIALE");
        assertThat(result.getRecetteTotale()).isEqualTo(50000.0);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // SIÈGES D'UN VOYAGE
    // ═════════════════════════════════════════════════════════════════════════

    @Test
    @DisplayName("Obtenir sièges voyage - carte de disponibilité")
    void getSiegesVoyage_retourneCarteSieges() {
        when(voyageDataRepository.findById("voyage-1")).thenReturn(Optional.of(voyageData));
        when(reservationRepository.findSiegesOccupes(
                "voyage-1", StatutReservation.ANNULEE, StatutReservation.EXPIREE))
                .thenReturn(Set.of(1, 2));
        when(seatLockManager.getSiegesVerrouilles("voyage-1"))
                .thenReturn(Set.of(3));

        Map<String, Object> result = reservationService.getSiegesVoyage("voyage-1");

        assertThat(result.get("capacite")).isEqualTo(70);
        @SuppressWarnings("unchecked")
        List<Integer> disponibles = (List<Integer>) result.get("disponibles");
        assertThat(disponibles).doesNotContain(1, 2, 3);
        assertThat(disponibles).contains(4, 5, 6);
        assertThat(result.get("libres")).isEqualTo(67);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // GETTERS SIMPLES
    // ═════════════════════════════════════════════════════════════════════════

    @Test
    @DisplayName("Obtenir réservation par ID")
    void getReservation_retourneReservation() {
        reservation.setId(1L);
        when(reservationRepository.findById(1L)).thenReturn(Optional.of(reservation));

        Reservation result = reservationService.getReservation(1L);

        assertThat(result).isEqualTo(reservation);
    }

    @Test
    @DisplayName("Obtenir réservations voyage")
    void getReservationsVoyage_retourneListeReservations() {
        List<Reservation> reservations = List.of(reservation);
        when(reservationRepository.findByIdVoyage("voyage-1")).thenReturn(reservations);

        List<Reservation> result = reservationService.getReservationsVoyage("voyage-1");

        assertThat(result).hasSize(1);
    }

    @Test
    @DisplayName("Obtenir réservations voyageur")
    void getReservationsVoyageur_retourneListeReservations() {
        List<Reservation> reservations = List.of(reservation);
        when(reservationRepository.findByIdVoyageur("user-1")).thenReturn(reservations);

        List<Reservation> result = reservationService.getReservationsVoyageur("user-1");

        assertThat(result).hasSize(1);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // HELPERS
    // ═════════════════════════════════════════════════════════════════════════

    private Reservation buildReservation() {
        return Reservation.builder()
                .idVoyage("voyage-1")
                .idVoyageur("user-1")
                .nombrePlaces(1)
                .canal(CanalReservation.WEB)
                .codeAgence("GEN")
                .codeFiliale("BYDE")
                .statut(StatutReservation.EN_ATTENTE)
                .montantTotal(5000.0)
                .devise("XAF")
                .dateReservation(LocalDateTime.now())
                .tickets(new ArrayList<>())
                .placesReservees(new ArrayList<>())
                .historique(new ArrayList<>())
                .build();
    }

    private ReservationRepository.PassagerProjection mockPassagerProjection(
            int numeroSiege, String nom, String prenom, String reservationId,
            StatutReservation statut, Double prixUnitaire) {
        ReservationRepository.PassagerProjection projection =
                mock(ReservationRepository.PassagerProjection.class);
        when(projection.getNumeroSiege()).thenReturn(numeroSiege);
        when(projection.getNomPassager()).thenReturn(nom + " " + prenom);
        when(projection.getTelephonePassager()).thenReturn("+237699000001");
        when(projection.getABagage()).thenReturn(false);
        when(projection.getEstResponsable()).thenReturn(true);
        when(projection.getPrixUnitaire()).thenReturn(prixUnitaire);
        when(projection.getReservationId()).thenReturn(Long.parseLong(reservationId));
        when(projection.getStatutReservation()).thenReturn(statut);
        when(projection.getCanal()).thenReturn(CanalReservation.WEB);
        when(projection.getMontantTotal()).thenReturn(prixUnitaire);
        when(projection.getDevise()).thenReturn("XAF");
        when(projection.getCodeAgence()).thenReturn("GEN");
        when(projection.getCodeFiliale()).thenReturn("BYDE");
        when(projection.getDateReservation()).thenReturn(LocalDateTime.now());
        return projection;
    }

    private ReservationRepository.StatutCount mockStatutCount(
            StatutReservation statut, long total) {
        ReservationRepository.StatutCount sc =
                mock(ReservationRepository.StatutCount.class);
        when(sc.getStatut()).thenReturn(statut);
        when(sc.getTotal()).thenReturn(total);
        return sc;
    }

    private ReservationRepository.CanalCount mockCanalCount(
            CanalReservation canal, long total) {
        ReservationRepository.CanalCount cc =
                mock(ReservationRepository.CanalCount.class);
        when(cc.getCanal()).thenReturn(canal);
        when(cc.getTotal()).thenReturn(total);
        return cc;
    }
}