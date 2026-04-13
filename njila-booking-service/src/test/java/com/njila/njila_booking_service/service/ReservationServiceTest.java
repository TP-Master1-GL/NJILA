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
    @Mock private ReservationLockManager          lockManager;
    @Mock private TicketNumberGenerator           ticketNumberGenerator;
    @Mock private PdfGeneratorService             pdfGeneratorService;
    @Mock private BookingEventPublisher           eventPublisher;
    
    @Mock private VoyageDataRepository            voyageDataRepository;
    @Mock private UserDataRepository              userDataRepository;
    @Mock private AgenceDataRepository            agenceDataRepository;
    @Mock private FilialeDataRepository           filialeDataRepository;

    @Mock private TicketElectroniqueFactory       ticketElectroniqueFactory;
    @Mock private TicketEmbarquementFactory       ticketEmbarquementFactory;
    @Mock private FideliteService                 fideliteService;
    @Mock private PrixStandardStrategy            prixStandard;
    @Mock private PrixGroupeStrategy              prixGroupe;
    @Mock private PrixPromoStrategy               prixPromo;

    @InjectMocks
    private ReservationService reservationService;

    private VoyageData voyageData;
    private UserData userData;

    @BeforeEach
    void setUp() {
        voyageData = VoyageData.builder()
                .id(1L)
                .prix(5000.0)
                .origine("YaoundÃ©")
                .destination("Douala")
                .dateHeureDepart(LocalDateTime.parse("2026-04-01T08:00:00"))
                .immatriculationBus("LT-1234-A")
                .placesDisponibles(70)
                .build();

        userData = UserData.builder()
                .id(1L)
                .nom("NGUEMBU")
                .prenom("John")
                .email("john@njila.cm")
                .telephone("+237699000001")
                .role("VOYAGEUR")
                .build();
    }

    private Reservation buildReservation() {
        return Reservation.builder()
                .idVoyage(1L).idVoyageur(1L)
                .nombrePlaces(1).canal(CanalReservation.WEB)
                .codeAgence("GEN").codeFiliale("BYDE")
                .statut(StatutReservation.EN_ATTENTE)
                .montantTotal(5000.0)
                .tickets(new ArrayList<>())
                .placesReservees(new ArrayList<>())
                .historique(new ArrayList<>())
                .build();
    }

    // âââ creerReservation âââââââââââââââââââââââââââââââââââââââââââââââââââââ

    @Test
    void creerReservation_web_standard_succes() {
        Reservation saved = buildReservation();
        saved.setId(1L);

        when(voyageDataRepository.findById(1L)).thenReturn(Optional.of(voyageData));
        when(reservationRepository.save(any())).thenReturn(saved);
        when(lockManager.acquerirVerrou(1L, 1L, 1L)).thenReturn(true);
        when(userDataRepository.findById(1L)).thenReturn(Optional.of(userData));
        when(prixStandard.calculerPrix(any(), eq(5000.0), eq(1))).thenReturn(5000.0);
        when(historiqueRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        Reservation result = reservationService.creerReservation(
                1L, 1L, 1, CanalReservation.WEB,
                "GEN", "BYDE", null,
                CreerReservationRequest.TypeTarif.STANDARD, null, "XAF");

        assertThat(result).isNotNull();
        assertThat(result.getStatut()).isEqualTo(StatutReservation.EN_ATTENTE);
        verify(eventPublisher).publierBookingCreated(1L, 5000.0, "XAF", 1L, 1L);
        verify(lockManager).acquerirVerrou(1L, 1L, 1L);
    }

    @Test
    void creerReservation_placesInsuffisantes_leveException() {
        voyageData.setPlacesDisponibles(2);
        when(voyageDataRepository.findById(1L)).thenReturn(Optional.of(voyageData));

        assertThatThrownBy(() ->
                reservationService.creerReservation(
                        1L, 1L, 3, CanalReservation.WEB,
                        "GEN", "BYDE", null,
                        CreerReservationRequest.TypeTarif.STANDARD, null, "XAF"))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Places insuffisantes");
    }

    @Test
    void creerReservation_verroupDejaExistant_leveException() {
        Reservation saved = buildReservation();
        saved.setId(1L);

        when(voyageDataRepository.findById(1L)).thenReturn(Optional.of(voyageData));
        when(reservationRepository.save(any())).thenReturn(saved);
        when(lockManager.acquerirVerrou(any(), any(), any())).thenReturn(false);

        assertThatThrownBy(() ->
                reservationService.creerReservation(
                        1L, 1L, 1, CanalReservation.WEB,
                        "GEN", "BYDE", null,
                        CreerReservationRequest.TypeTarif.STANDARD, null, "XAF"))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("rÃ©servation est dÃ©jÃ  en cours");

        verify(reservationRepository).delete(saved);
    }

    @Test
    void creerReservation_guichet_confirmeDirectement() {
        Reservation saved = buildReservation();
        saved.setId(1L);
        saved.setCanal(CanalReservation.GUICHET);

        when(voyageDataRepository.findById(1L)).thenReturn(Optional.of(voyageData));
        when(reservationRepository.save(any())).thenReturn(saved);
        when(lockManager.acquerirVerrou(any(), any(), any())).thenReturn(true);
        when(userDataRepository.findById(1L)).thenReturn(Optional.of(userData));
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
                1L, 1L, 1, CanalReservation.GUICHET,
                "GEN", "BYDE", 1L,
                CreerReservationRequest.TypeTarif.STANDARD, null, "XAF");

        verify(eventPublisher, never()).publierBookingCreated(any(), any(), any(), any(), any());
        verify(ticketRepository).save(any());
        verify(fideliteService).incrementer(1L, "GEN");
    }

    // âââ confirmerPaiementEspeces (CORRECTION PATCH /confirm) âââââââââââââââââ

    @Test
    void confirmerPaiementEspeces_reservationEnAttente_genereBilletEmbarquement() {
        Reservation reservation = buildReservation();
        reservation.setId(1L);
        reservation.setStatut(StatutReservation.EN_ATTENTE);

        when(reservationRepository.findById(1L)).thenReturn(Optional.of(reservation));
        when(reservationRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(voyageDataRepository.findById(1L)).thenReturn(Optional.of(voyageData));
        when(userDataRepository.findById(1L)).thenReturn(Optional.of(userData));
        when(ticketNumberGenerator.genererBilletEmbarquement("GEN", "BYDE"))
                .thenReturn("GEN-EMB-20260321-BYDE-000001");

        TicketEmbarquement ticketEmb = new TicketEmbarquement();
        ticketEmb.setNumeroTicket("GEN-EMB-20260321-BYDE-000001");
        when(ticketEmbarquementFactory.creerTicket(
                any(), any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(ticketEmb);
        when(ticketRepository.save(any())).thenReturn(ticketEmb);
        when(historiqueRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        TicketEmbarquement result = reservationService
                .confirmerPaiementEspeces(1L, 99L, 5000.0);

        assertThat(result.getNumeroTicket()).isEqualTo("GEN-EMB-20260321-BYDE-000001");
        assertThat(reservation.getStatut()).isEqualTo(StatutReservation.PAYEE);
        verify(fideliteService).incrementer(1L, "GEN");
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
                reservationService.confirmerPaiementEspeces(1L, 99L, 5000.0))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("EN_ATTENTE");
    }

    @Test
    void confirmerPaiementEspeces_reservationIntrouvable_leveException() {
        when(reservationRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() ->
                reservationService.confirmerPaiementEspeces(99L, 1L, 5000.0))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("introuvable");
    }

    // âââ annulerReservation â CORRECTION UC-B4 (remboursement) âââââââââââââââ

    @Test
    void annulerReservation_etaitPayee_publieRemboursement() {
        Reservation reservation = buildReservation();
        reservation.setId(1L);
        reservation.setStatut(StatutReservation.PAYEE);
        reservation.setMontantTotal(5000.0);

        when(reservationRepository.findById(1L)).thenReturn(Optional.of(reservation));
        when(reservationRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(paiementRepository.findByReservationId(1L)).thenReturn(Optional.empty());
        when(historiqueRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        reservationService.annulerReservation(1L, 1L);

        assertThat(reservation.getStatut()).isEqualTo(StatutReservation.ANNULEE);
        verify(eventPublisher).publierRemboursementDemande(
                eq(1L), eq(1L), eq(5000.0), anyString(), anyString());
    }

    // âââ validerBilletDepart â NOUVEAU UC-B7 âââââââââââââââââââââââââââââââââ

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
                "GEN-EMB-20260401-BYDE-000001", 10L);

        assertThat(result.getStatut()).isEqualTo(StatutTicket.EMBARQUEE);
        assertThat(result.getUtilise()).isTrue();
        assertThat(reservation.getStatut()).isEqualTo(StatutReservation.EMBARQUEE);
    }

    // âââ cloturerDepart â NOUVEAU UC-B7 ââââââââââââââââââââââââââââââââââââââ

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

        when(reservationRepository.findByIdVoyage(1L))
                .thenReturn(List.of(r1, r2, r3));

        Map<String, Object> result = reservationService.cloturerDepart(1L, 10L);

        assertThat(result.get("passagersEmbarques")).isEqualTo(2L);
        assertThat(result.get("statut")).isEqualTo("DEPART_CLOTURE");

        verify(eventPublisher).publierDepartVoyage(eq(1L), eq(10L), eq(2), anyInt());
    }

    // getStatsFiliale â€” CORRECTION stats

    @Test
    void getStatsFiliale_retourneMetriquesAggregees() {
        ReservationRepository.StatutCount sc1 = mockStatutCount(StatutReservation.PAYEE, 10);
        ReservationRepository.StatutCount sc2 = mockStatutCount(StatutReservation.ANNULEE, 3);
        ReservationRepository.StatutCount sc3 = mockStatutCount(StatutReservation.EN_ATTENTE, 2);
        ReservationRepository.StatutCount sc4 = mockStatutCount(StatutReservation.EMBARQUEE, 5);

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

    //  confirmerApresPaiement

    @Test
    void confirmerApresPaiement_passeLaReservationEnPayee() {
        Reservation reservation = buildReservation();
        reservation.setId(1L);

        when(reservationRepository.findById(1L)).thenReturn(Optional.of(reservation));
        when(reservationRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(paiementRepository.findByReservationId(1L)).thenReturn(Optional.empty());
        when(voyageDataRepository.findById(1L)).thenReturn(Optional.of(voyageData));
        when(userDataRepository.findById(1L)).thenReturn(Optional.of(userData));
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
        verify(fideliteService).incrementer(1L, "GEN");
        verify(lockManager).libererVerrou(1L, 1L);
    }

    //  Helpers 

    private ReservationRepository.StatutCount mockStatutCount(
            StatutReservation statut, long total) {
        ReservationRepository.StatutCount sc =
                mock(ReservationRepository.StatutCount.class);
        when(sc.getStatut()).thenReturn(statut);
        when(sc.getTotal()).thenReturn(total);
        return sc;
    }
}
