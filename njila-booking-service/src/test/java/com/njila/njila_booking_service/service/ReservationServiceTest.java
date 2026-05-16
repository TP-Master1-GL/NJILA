package com.njila.njila_booking_service.service;

import com.njila.njila_booking_service.domain.entity.*;
import com.njila.njila_booking_service.domain.entity.projection.*;
import com.njila.njila_booking_service.domain.enums.*;
import com.njila.njila_booking_service.dto.request.CreerReservationRequest;
import com.njila.njila_booking_service.dto.response.ReservationStatsResponse;
import com.njila.njila_booking_service.messaging.publisher.BookingEventPublisher;
import com.njila.njila_booking_service.repository.*;
import com.njila.njila_booking_service.repository.projection.*;
import com.njila.njila_booking_service.service.factory.*;
import com.njila.njila_booking_service.service.pricing.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.*;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ReservationServiceTest {

    @Mock private ReservationRepository           reservationRepository;
    @Mock private TicketRepository                ticketRepository;
    @Mock private PaiementRepository              paiementRepository;
    @Mock private HistoriqueReservationRepository historiqueRepository;
    @Mock private PlaceReserveeRepository         placeReserveeRepository;
    // Nouveau : SeatLockManager remplace ReservationLockManager
    @Mock private SeatLockManager                 seatLockManager;
    @Mock private TicketNumberGenerator           ticketNumberGenerator;
    @Mock private PdfGeneratorService             pdfGeneratorService;
    @Mock private BookingEventPublisher           eventPublisher;

    @Mock private VoyageDataRepository            voyageDataRepository;
    @Mock private UserDataRepository              userDataRepository;
    @Mock private AgenceDataRepository            agenceDataRepository;
    @Mock private FilialeDataRepository           filialeDataRepository;
    @Mock private BusDataRepository               busDataRepository;

    @Mock private TicketElectroniqueFactory       ticketElectroniqueFactory;
    @Mock private TicketEmbarquementFactory       ticketEmbarquementFactory;
    @Mock private FideliteService                 fideliteService;
    @Mock private PrixStandardStrategy            prixStandard;
    @Mock private PrixGroupeStrategy              prixGroupe;
    @Mock private PrixPromoStrategy               prixPromo;

    @InjectMocks
    private ReservationService reservationService;

    private VoyageData voyageData;
    private UserData   userData;

    @BeforeEach
    void setUp() {
        voyageData = VoyageData.builder()
                .id("voyage-1")
                .prix(5000.0)
                .origine("Yaoundé")
                .destination("Douala")
                .dateHeureDepart(LocalDateTime.parse("2026-04-01T08:00:00"))
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
                .build();
    }

    private Reservation buildReservation() {
        return Reservation.builder()
                .idVoyage("voyage-1").idVoyageur("user-1")
                .nombrePlaces(1).canal(CanalReservation.WEB)
                .codeAgence("GEN").codeFiliale("BYDE")
                .statut(StatutReservation.EN_ATTENTE)
                .montantTotal(5000.0)
                .tickets(new ArrayList<>())
                .placesReservees(new ArrayList<>())
                .historique(new ArrayList<>())
                .build();
    }

    // ─── Helper commun : stubber l'attribution des sièges ────────────────────
    // Aucun siège occupé en DB ni en Redis → sièges libres dès le numéro 1
    private void stubSiegesLibres() {
        when(reservationRepository.findSiegesOccupes("voyage-1"))
                .thenReturn(Set.of());
        when(seatLockManager.getSiegesVerrouilles("voyage-1"))
                .thenReturn(Set.of());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // creerReservation
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void creerReservation_web_standard_succes() {
        Reservation saved = buildReservation();
        saved.setId(1L);

        when(voyageDataRepository.findById("voyage-1")).thenReturn(Optional.of(voyageData));
        stubSiegesLibres();
        when(userDataRepository.findById("user-1")).thenReturn(Optional.of(userData));
        // Verrou par siège → acquerirVerrouSieges([1]) retourne true
        when(seatLockManager.acquerirVerrouSieges(eq("voyage-1"), eq("user-1"), anyList()))
                .thenReturn(true);
        when(reservationRepository.save(any())).thenReturn(saved);
        when(prixStandard.calculerPrix(any(), eq(5000.0), eq(1))).thenReturn(5000.0);
        when(historiqueRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        Reservation result = reservationService.creerReservation(
                "voyage-1", "user-1",
                "NGUEMBU", "John", "+237699000001", "john@njila.cm",
                1, CanalReservation.WEB,
                "GEN", "BYDE", null,
                CreerReservationRequest.TypeTarif.STANDARD, null,
                null,   // siegesDemandes — attribution automatique
                "XAF");

        assertThat(result).isNotNull();
        assertThat(result.getStatut()).isEqualTo(StatutReservation.EN_ATTENTE);
        verify(eventPublisher).publierBookingCreated(1L, 5000.0, "XAF", "user-1", "voyage-1");
        verify(seatLockManager).acquerirVerrouSieges(
                eq("voyage-1"), eq("user-1"), anyList());
    }

    @Test
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
                        null, "XAF"))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Places insuffisantes");

        // Le verrou ne doit jamais être tenté
        verify(seatLockManager, never())
                .acquerirVerrouSieges(any(), any(), any());
    }

    @Test
    void creerReservation_siegeDejaVerrouille_leveException() {
        Reservation saved = buildReservation();
        saved.setId(1L);

        when(voyageDataRepository.findById("voyage-1")).thenReturn(Optional.of(voyageData));
        stubSiegesLibres();
        when(userDataRepository.findById("user-1")).thenReturn(Optional.of(userData));
        when(seatLockManager.acquerirVerrouSieges(any(), any(), any()))
                .thenReturn(false);
        when(reservationRepository.save(any())).thenReturn(saved);
        when(prixStandard.calculerPrix(any(), anyDouble(), anyInt())).thenReturn(5000.0);

        assertThatThrownBy(() ->
                reservationService.creerReservation(
                        "voyage-1", "user-1",
                        "NGUEMBU", "John", null, null,
                        1, CanalReservation.WEB,
                        "GEN", "BYDE", null,
                        CreerReservationRequest.TypeTarif.STANDARD, null,
                        null, "XAF"))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("sièges demandés viennent d'être réservés");

        // La réservation partiellement créée est supprimée
        verify(reservationRepository).delete(saved);
        // Les verrous ne sont pas libérés (aucun acquis)
        verify(seatLockManager, never()).libererSieges(any(), any());
    }

    @Test
    void creerReservation_siegeSpecifiqueDemande_utiliseLeNumeroExact() {
        Reservation saved = buildReservation();
        saved.setId(1L);

        when(voyageDataRepository.findById("voyage-1")).thenReturn(Optional.of(voyageData));
        stubSiegesLibres();
        when(userDataRepository.findById("user-1")).thenReturn(Optional.of(userData));
        when(seatLockManager.acquerirVerrouSieges(
                eq("voyage-1"), eq("user-1"), eq(List.of(15))))
                .thenReturn(true);
        when(reservationRepository.save(any())).thenReturn(saved);
        when(prixStandard.calculerPrix(any(), anyDouble(), anyInt())).thenReturn(5000.0);
        when(historiqueRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        reservationService.creerReservation(
                "voyage-1", "user-1",
                "NGUEMBU", "John", null, null,
                1, CanalReservation.WEB,
                "GEN", "BYDE", null,
                CreerReservationRequest.TypeTarif.STANDARD, null,
                List.of(15),   // siège 15 demandé explicitement
                "XAF");

        verify(seatLockManager).acquerirVerrouSieges(
                "voyage-1", "user-1", List.of(15));
    }

    @Test
    void creerReservation_siegeDemandeOccupeEnDB_leveException() {
        when(voyageDataRepository.findById("voyage-1")).thenReturn(Optional.of(voyageData));
        // Siège 5 déjà occupé en DB
        when(reservationRepository.findSiegesOccupes("voyage-1")).thenReturn(Set.of(5));
        when(seatLockManager.getSiegesVerrouilles("voyage-1")).thenReturn(Set.of());

        assertThatThrownBy(() ->
                reservationService.creerReservation(
                        "voyage-1", "user-1",
                        "NGUEMBU", "John", null, null,
                        1, CanalReservation.WEB,
                        "GEN", "BYDE", null,
                        CreerReservationRequest.TypeTarif.STANDARD, null,
                        List.of(5),
                        "XAF"))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("déjà réservé");
    }

    @Test
    void creerReservation_guichet_confirmeDirectement() {
        Reservation saved = buildReservation();
        saved.setId(1L);
        saved.setCanal(CanalReservation.GUICHET);

        when(voyageDataRepository.findById("voyage-1")).thenReturn(Optional.of(voyageData));
        stubSiegesLibres();
        when(userDataRepository.findById("user-1")).thenReturn(Optional.of(userData));
        when(seatLockManager.acquerirVerrouSieges(any(), any(), any())).thenReturn(true);
        when(reservationRepository.save(any())).thenReturn(saved);
        when(prixStandard.calculerPrix(any(), anyDouble(), anyInt())).thenReturn(5000.0);
        when(historiqueRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(ticketNumberGenerator.genererBilletEmbarquement("GEN", "BYDE"))
                .thenReturn("GEN-EMB-20260321-BYDE-000001");

        TicketEmbarquement ticketEmb = new TicketEmbarquement();
        ticketEmb.setNumeroTicket("GEN-EMB-20260321-BYDE-000001");
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
                null, "XAF");

        // Canal GUICHET → pas d'événement booking.created
        verify(eventPublisher, never()).publierBookingCreated(any(), any(), any(), any(), any());
        // Billet généré immédiatement
        verify(ticketRepository).save(any());
        verify(fideliteService).incrementer("user-1", "GEN");
        // Verrous libérés après succès guichet
        verify(seatLockManager).libererSieges(eq("voyage-1"), anyList());
    }

    @Test
    void creerReservation_deuxVoyageursSiegesDifferents_noBlocking() {
        // Simule deux appels simultanés pour des sièges différents :
        // A demande le siège 1, B demande le siège 2 → aucun conflit
        Reservation savedA = buildReservation(); savedA.setId(1L);
        Reservation savedB = buildReservation(); savedB.setId(2L);
        savedB.setIdVoyageur("user-2");

        when(voyageDataRepository.findById("voyage-1"))
                .thenReturn(Optional.of(voyageData));

        // A : aucun siège occupé
        when(reservationRepository.findSiegesOccupes("voyage-1"))
                .thenReturn(Set.of());
        when(seatLockManager.getSiegesVerrouilles("voyage-1"))
                .thenReturn(Set.of());
        when(userDataRepository.findById(any())).thenReturn(Optional.of(userData));
        when(seatLockManager.acquerirVerrouSieges(any(), any(), anyList()))
                .thenReturn(true);
        when(reservationRepository.save(any()))
                .thenReturn(savedA).thenReturn(savedB);
        when(prixStandard.calculerPrix(any(), anyDouble(), anyInt()))
                .thenReturn(5000.0);
        when(historiqueRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        // Les deux appels doivent réussir sans bloquer l'un l'autre
        Reservation resultA = reservationService.creerReservation(
                "voyage-1", "user-1",
                "A", "Client", null, null,
                1, CanalReservation.WEB, "GEN", "BYDE", null,
                CreerReservationRequest.TypeTarif.STANDARD, null,
                List.of(1), "XAF");

        Reservation resultB = reservationService.creerReservation(
                "voyage-1", "user-2",
                "B", "Client", null, null,
                1, CanalReservation.WEB, "GEN", "BYDE", null,
                CreerReservationRequest.TypeTarif.STANDARD, null,
                List.of(2), "XAF");

        assertThat(resultA).isNotNull();
        assertThat(resultB).isNotNull();
        // Deux verrous acquis, sur des sièges distincts
        verify(seatLockManager, times(2))
                .acquerirVerrouSieges(eq("voyage-1"), any(), anyList());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // confirmerPaiementEspeces
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void confirmerPaiementEspeces_reservationEnAttente_genereBilletEmbarquement() {
        Reservation reservation = buildReservation();
        reservation.setId(1L);
        reservation.setStatut(StatutReservation.EN_ATTENTE);
        // Siège attribué à cette réservation
        PlaceReservee place = PlaceReservee.builder()
                .numeroSiege(3).reservation(reservation).build();
        reservation.getPlacesReservees().add(place);

        when(reservationRepository.findById(1L)).thenReturn(Optional.of(reservation));
        when(reservationRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(voyageDataRepository.findById("voyage-1")).thenReturn(Optional.of(voyageData));
        when(userDataRepository.findById("user-1")).thenReturn(Optional.of(userData));
        when(ticketNumberGenerator.genererBilletEmbarquement("GEN", "BYDE"))
                .thenReturn("GEN-EMB-20260321-BYDE-000001");

        TicketEmbarquement ticketEmb = new TicketEmbarquement();
        ticketEmb.setNumeroTicket("GEN-EMB-20260321-BYDE-000001");
        when(ticketEmbarquementFactory.creerTicket(
                any(), any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(ticketEmb);
        when(ticketRepository.save(any())).thenReturn(ticketEmb);
        when(historiqueRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        TicketEmbarquement result =
                reservationService.confirmerPaiementEspeces(1L, "guichet-1", 5000.0);

        assertThat(result.getNumeroTicket()).isEqualTo("GEN-EMB-20260321-BYDE-000001");
        assertThat(reservation.getStatut()).isEqualTo(StatutReservation.PAYEE);
        verify(fideliteService).incrementer("user-1", "GEN");
        // Verrou du siège 3 libéré après paiement
        verify(seatLockManager).libererSieges("voyage-1", List.of(3));
        verify(eventPublisher).publierTicketGenerated(
                any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void confirmerPaiementEspeces_reservationDejaPayee_leveException() {
        Reservation reservation = buildReservation();
        reservation.setId(1L);
        reservation.setStatut(StatutReservation.PAYEE);

        when(reservationRepository.findById(1L)).thenReturn(Optional.of(reservation));

        assertThatThrownBy(() ->
                reservationService.confirmerPaiementEspeces(1L, "guichet-1", 5000.0))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("EN_ATTENTE");
    }

    @Test
    void confirmerPaiementEspeces_reservationIntrouvable_leveException() {
        when(reservationRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() ->
                reservationService.confirmerPaiementEspeces(99L, "user-1", 5000.0))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("introuvable");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // confirmerApresPaiement
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void confirmerApresPaiement_passeLaReservationEnPayee() {
        Reservation reservation = buildReservation();
        reservation.setId(1L);
        PlaceReservee place = PlaceReservee.builder()
                .numeroSiege(7).reservation(reservation).build();
        reservation.getPlacesReservees().add(place);

        when(reservationRepository.findById(1L)).thenReturn(Optional.of(reservation));
        when(reservationRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(paiementRepository.findByReservationId(1L)).thenReturn(Optional.empty());
        when(voyageDataRepository.findById("voyage-1")).thenReturn(Optional.of(voyageData));
        when(userDataRepository.findById("user-1")).thenReturn(Optional.of(userData));
        when(ticketNumberGenerator.genererBilletElectronique("GEN", "BYDE"))
                .thenReturn("GEN-WEB-20260321-BYDE-000001");

        TicketElectronique ticketElec = new TicketElectronique();
        ticketElec.setNumeroTicket("GEN-WEB-20260321-BYDE-000001");
        ticketElec.setDateDepart(java.time.LocalDate.of(2026, 4, 1));
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
        // Verrou du siège 7 libéré après confirmation paiement
        verify(seatLockManager).libererSieges("voyage-1", List.of(7));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // annulerReservation
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void annulerReservation_etaitPayee_publieRemboursementEtLibereSiege() {
        Reservation reservation = buildReservation();
        reservation.setId(1L);
        reservation.setStatut(StatutReservation.PAYEE);
        reservation.setMontantTotal(5000.0);
        PlaceReservee place = PlaceReservee.builder()
                .numeroSiege(12).reservation(reservation).build();
        reservation.getPlacesReservees().add(place);

        when(reservationRepository.findById(1L)).thenReturn(Optional.of(reservation));
        when(reservationRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(paiementRepository.findByReservationId(1L)).thenReturn(Optional.empty());
        when(historiqueRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        reservationService.annulerReservation(1L, "user-1");

        assertThat(reservation.getStatut()).isEqualTo(StatutReservation.ANNULEE);
        // Siège 12 libéré → disponible pour de nouveaux clients
        verify(seatLockManager).libererSieges("voyage-1", List.of(12));
        verify(eventPublisher).publierRemboursementDemande(
                eq(1L), eq("user-1"), eq(5000.0), anyString(), anyString());
    }

    @Test
    void annulerReservation_enAttente_libereSiegeSansRemboursement() {
        Reservation reservation = buildReservation();
        reservation.setId(1L);
        reservation.setStatut(StatutReservation.EN_ATTENTE);
        reservation.setMontantTotal(5000.0);
        PlaceReservee place = PlaceReservee.builder()
                .numeroSiege(4).reservation(reservation).build();
        reservation.getPlacesReservees().add(place);

        when(reservationRepository.findById(1L)).thenReturn(Optional.of(reservation));
        when(reservationRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(paiementRepository.findByReservationId(1L)).thenReturn(Optional.empty());
        when(historiqueRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        reservationService.annulerReservation(1L, "user-1");

        verify(seatLockManager).libererSieges("voyage-1", List.of(4));
        // Pas de remboursement car statut était EN_ATTENTE
        verify(eventPublisher, never()).publierRemboursementDemande(
                any(), any(), any(), any(), any());
    }

    @Test
    void annulerReservation_dejaEmbarquee_leveException() {
        Reservation reservation = buildReservation();
        reservation.setId(1L);
        reservation.setStatut(StatutReservation.EMBARQUEE);

        when(reservationRepository.findById(1L)).thenReturn(Optional.of(reservation));

        assertThatThrownBy(() ->
                reservationService.annulerReservation(1L, "user-1"))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("embarquée");

        verify(seatLockManager, never()).libererSieges(any(), any());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // annulerApresEchecPaiement
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void annulerApresEchecPaiement_libereSiegesImmediatement() {
        Reservation reservation = buildReservation();
        reservation.setId(1L);
        PlaceReservee place = PlaceReservee.builder()
                .numeroSiege(9).reservation(reservation).build();
        reservation.getPlacesReservees().add(place);

        when(reservationRepository.findById(1L)).thenReturn(Optional.of(reservation));
        when(reservationRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(paiementRepository.findByReservationId(1L)).thenReturn(Optional.empty());
        when(historiqueRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        reservationService.annulerApresEchecPaiement(1L);

        assertThat(reservation.getStatut()).isEqualTo(StatutReservation.ANNULEE);
        // Siège 9 libéré immédiatement → disponible pour d'autres clients
        verify(seatLockManager).libererSieges("voyage-1", List.of(9));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // validerBilletDepart (UC-B7)
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void validerBilletDepart_billetEmbarquement_marqueEmbarque() {
        Reservation reservation = buildReservation();
        reservation.setId(1L);
        reservation.setStatut(StatutReservation.PAYEE);

        TicketEmbarquement ticket = new TicketEmbarquement();
        ticket.setNumeroTicket("GEN-EMB-20260401-BYDE-000001");
        ticket.setStatut(StatutTicket.ACTIF);
        ticket.setUtilise(false);
        ticket.setReservation(reservation);

        when(ticketRepository.findByNumeroTicket("GEN-EMB-20260401-BYDE-000001"))
                .thenReturn(Optional.of(ticket));
        when(ticketRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(reservationRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(historiqueRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        Ticket result = reservationService.validerBilletDepart(
                "GEN-EMB-20260401-BYDE-000001", "manager-1");

        assertThat(result.getStatut()).isEqualTo(StatutTicket.EMBARQUEE);
        assertThat(result.getUtilise()).isTrue();
        assertThat(reservation.getStatut()).isEqualTo(StatutReservation.EMBARQUEE);
    }

    @Test
    void validerBilletDepart_billetDejaValide_leveException() {
        Reservation reservation = buildReservation();
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
    void validerBilletDepart_billetElectroniqueNonConverti_leveException() {
        Reservation reservation = buildReservation();

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

    // ─────────────────────────────────────────────────────────────────────────
    // cloturerDepart (UC-B7)
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void cloturerDepart_publieEvenementDepart() {
        Reservation r1 = buildReservation();
        r1.setStatut(StatutReservation.EMBARQUEE);
        r1.setNombrePlaces(2);

        Reservation r2 = buildReservation();
        r2.setStatut(StatutReservation.EMBARQUEE);
        r2.setNombrePlaces(1);

        Reservation r3 = buildReservation();
        r3.setStatut(StatutReservation.ANNULEE);
        r3.setNombrePlaces(1);

        when(reservationRepository.findByIdVoyage("voyage-1"))
                .thenReturn(List.of(r1, r2, r3));

        Map<String, Object> result =
                reservationService.cloturerDepart("voyage-1", "manager-1");

        assertThat(result.get("passagersEmbarques")).isEqualTo(2L);
        assertThat(result.get("statut")).isEqualTo("DEPART_CLOTURE");
        verify(eventPublisher).publierDepartVoyage(
                eq("voyage-1"), eq("manager-1"), eq(2), anyInt());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // getSiegesVoyage
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void getSiegesVoyage_retourneCarteSieges() {
        when(voyageDataRepository.findById("voyage-1")).thenReturn(Optional.of(voyageData));
        // Sièges 1 et 2 occupés en DB, siège 3 verrouillé en Redis
        when(reservationRepository.findSiegesOccupes("voyage-1"))
                .thenReturn(Set.of(1, 2));
        when(seatLockManager.getSiegesVerrouilles("voyage-1"))
                .thenReturn(Set.of(3));

        Map<String, Object> result = reservationService.getSiegesVoyage("voyage-1");

        assertThat(result.get("capacite")).isEqualTo(70);
        @SuppressWarnings("unchecked")
        List<Integer> disponibles = (List<Integer>) result.get("disponibles");
        assertThat(disponibles).doesNotContain(1, 2, 3);
        assertThat(disponibles).contains(4, 5, 6);
        @SuppressWarnings("unchecked")
        List<Integer> enAttente = (List<Integer>) result.get("enAttente");
        assertThat(enAttente).contains(3);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // getStatsFiliale
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void getStatsFiliale_retourneMetriquesAggregees() {
        ReservationRepository.StatutCount sc1 =
                mockStatutCount(StatutReservation.PAYEE, 10);
        ReservationRepository.StatutCount sc2 =
                mockStatutCount(StatutReservation.ANNULEE, 3);
        ReservationRepository.StatutCount sc3 =
                mockStatutCount(StatutReservation.EN_ATTENTE, 2);
        ReservationRepository.StatutCount sc4 =
                mockStatutCount(StatutReservation.EMBARQUEE, 5);

        when(reservationRepository.countByStatutForFiliale("BYDE"))
                .thenReturn(List.of(sc1, sc2, sc3, sc4));
        when(reservationRepository.sumMontantByCodeFiliale("BYDE"))
                .thenReturn(75000.0);
        when(reservationRepository.sumPlacesVenduesByCodeFiliale("BYDE"))
                .thenReturn(20L);

        ReservationStatsResponse stats = reservationService.getStatsFiliale("BYDE");

        assertThat(stats.getTotalReservations()).isEqualTo(20L);
        assertThat(stats.getReservationsConfirmees()).isEqualTo(15L);
        assertThat(stats.getChiffreAffairesTotal()).isEqualTo(75000.0);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────────

    private ReservationRepository.StatutCount mockStatutCount(
            StatutReservation statut, long total) {
        ReservationRepository.StatutCount sc =
                mock(ReservationRepository.StatutCount.class);
        when(sc.getStatut()).thenReturn(statut);
        when(sc.getTotal()).thenReturn(total);
        return sc;
    }
}
