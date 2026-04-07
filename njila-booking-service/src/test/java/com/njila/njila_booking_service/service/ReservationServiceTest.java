package com.njila.njila_booking_service.service;

import com.njila.njila_booking_service.client.FleetServiceClient;
import com.njila.njila_booking_service.client.ServiceIndisponibleException;
import com.njila.njila_booking_service.client.UserServiceClient;
import com.njila.njila_booking_service.domain.entity.*;
import com.njila.njila_booking_service.domain.enums.*;
import com.njila.njila_booking_service.dto.request.CreerReservationRequest;
import com.njila.njila_booking_service.dto.response.ReservationStatsResponse;
import com.njila.njila_booking_service.messaging.publisher.BookingEventPublisher;
import com.njila.njila_booking_service.repository.*;
import com.njila.njila_booking_service.service.factory.*;
import com.njila.njila_booking_service.service.pricing.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
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
    @Mock private FleetServiceClient              fleetClient;
    @Mock private UserServiceClient               userClient;
    @Mock private TicketElectroniqueFactory       ticketElectroniqueFactory;
    @Mock private TicketEmbarquementFactory       ticketEmbarquementFactory;
    @Mock private FideliteService                 fideliteService;
    @Mock private PrixStandardStrategy            prixStandard;
    @Mock private PrixGroupeStrategy              prixGroupe;
    @Mock private PrixPromoStrategy               prixPromo;

    @InjectMocks
    private ReservationService reservationService;

    private Map<String, Object> mockVoyage;
    private Map<String, Object> mockVoyageur;

    @BeforeEach
    void setUp() {
        mockVoyage = new HashMap<>();
        mockVoyage.put("id",                1);
        mockVoyage.put("prix",              5000.0);
        mockVoyage.put("origine",           "Yaoundé");
        mockVoyage.put("destination",       "Douala");
        mockVoyage.put("dateHeureDepart",   "2026-04-01T08:00:00");
        mockVoyage.put("immatriculationBus","LT-1234-A");

        mockVoyageur = new HashMap<>();
        mockVoyageur.put("id",      1);
        mockVoyageur.put("nom",     "NGUEMBU");
        mockVoyageur.put("surname", "John");
        mockVoyageur.put("email",   "john@njila.cm");
        mockVoyageur.put("phone",   "+237699000001");
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

    // ─── creerReservation ─────────────────────────────────────────────────────

    @Test
    void creerReservation_web_standard_succes() {
        Reservation saved = buildReservation();
        saved.setId(1L);

        when(fleetClient.verifierDisponibilite(1L, 1)).thenReturn(true);
        when(reservationRepository.save(any())).thenReturn(saved);
        when(lockManager.acquerirVerrou(1L, 1L, 1L)).thenReturn(true);
        when(fleetClient.getVoyage(1L)).thenReturn(mockVoyage);
        when(userClient.getVoyageur(1L)).thenReturn(mockVoyageur);
        when(prixStandard.calculerPrix(any(), eq(5000.0), eq(1))).thenReturn(5000.0);
        when(historiqueRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        Reservation result = reservationService.creerReservation(
                1L, 1L, 1, CanalReservation.WEB,
                "GEN", "BYDE", null,
                CreerReservationRequest.TypeTarif.STANDARD, null);

        assertThat(result).isNotNull();
        assertThat(result.getStatut()).isEqualTo(StatutReservation.EN_ATTENTE);
        verify(eventPublisher).publierBookingCreated(1L, 5000.0, 1L, 1L);
        verify(lockManager).acquerirVerrou(1L, 1L, 1L);
    }

    @Test
    void creerReservation_placesInsuffisantes_leveException() {
        when(fleetClient.verifierDisponibilite(1L, 3)).thenReturn(false);

        assertThatThrownBy(() ->
                reservationService.creerReservation(
                        1L, 1L, 3, CanalReservation.WEB,
                        "GEN", "BYDE", null,
                        CreerReservationRequest.TypeTarif.STANDARD, null))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Places insuffisantes");
    }

    @Test
    void creerReservation_verroupDejaExistant_leveException() {
        Reservation saved = buildReservation();
        saved.setId(1L);

        when(fleetClient.verifierDisponibilite(1L, 1)).thenReturn(true);
        when(reservationRepository.save(any())).thenReturn(saved);
        when(lockManager.acquerirVerrou(any(), any(), any())).thenReturn(false);

        assertThatThrownBy(() ->
                reservationService.creerReservation(
                        1L, 1L, 1, CanalReservation.WEB,
                        "GEN", "BYDE", null,
                        CreerReservationRequest.TypeTarif.STANDARD, null))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("réservation est déjà en cours");

        verify(reservationRepository).delete(saved);
    }

    @Test
    void creerReservation_fleetServiceIndisponible_leveServiceIndisponibleException() {
        when(fleetClient.verifierDisponibilite(any(), anyInt()))
                .thenThrow(new ServiceIndisponibleException("fleet-service indisponible"));

        assertThatThrownBy(() ->
                reservationService.creerReservation(
                        1L, 1L, 1, CanalReservation.WEB,
                        "GEN", "BYDE", null,
                        CreerReservationRequest.TypeTarif.STANDARD, null))
                .isInstanceOf(ServiceIndisponibleException.class);
    }

    @Test
    void creerReservation_guichet_confirmeDirectement() {
        Reservation saved = buildReservation();
        saved.setId(1L);
        saved.setCanal(CanalReservation.GUICHET);

        when(fleetClient.verifierDisponibilite(1L, 1)).thenReturn(true);
        when(reservationRepository.save(any())).thenReturn(saved);
        when(lockManager.acquerirVerrou(any(), any(), any())).thenReturn(true);
        when(fleetClient.getVoyage(1L)).thenReturn(mockVoyage);
        when(userClient.getVoyageur(1L)).thenReturn(mockVoyageur);
        when(prixStandard.calculerPrix(any(), anyDouble(), anyInt())).thenReturn(5000.0);
        when(historiqueRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(ticketNumberGenerator.genererBilletEmbarquement("GEN", "BYDE"))
                .thenReturn("GEN-EMB-20260321-BYDE-000001");

        TicketEmbarquement ticketEmb = new TicketEmbarquement();
        ticketEmb.setNumeroTicket("GEN-EMB-20260321-BYDE-000001");
        when(ticketEmbarquementFactory.creerTicket(
                any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(ticketEmb);
        when(ticketRepository.save(any())).thenReturn(ticketEmb);

        reservationService.creerReservation(
                1L, 1L, 1, CanalReservation.GUICHET,
                "GEN", "BYDE", 1L,
                CreerReservationRequest.TypeTarif.STANDARD, null);

        verify(eventPublisher, never()).publierBookingCreated(any(), any(), any(), any());
        verify(ticketRepository).save(any());
        verify(fideliteService).incrementer(1L, "GEN");
    }

    // ─── confirmerPaiementEspeces (CORRECTION PATCH /confirm) ─────────────────

    @Test
    void confirmerPaiementEspeces_reservationEnAttente_genereBilletEmbarquement() {
        Reservation reservation = buildReservation();
        reservation.setId(1L);
        reservation.setStatut(StatutReservation.EN_ATTENTE);

        when(reservationRepository.findById(1L)).thenReturn(Optional.of(reservation));
        when(reservationRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(fleetClient.getVoyage(1L)).thenReturn(mockVoyage);
        when(userClient.getVoyageur(1L)).thenReturn(mockVoyageur);
        when(ticketNumberGenerator.genererBilletEmbarquement("GEN", "BYDE"))
                .thenReturn("GEN-EMB-20260321-BYDE-000001");

        TicketEmbarquement ticketEmb = new TicketEmbarquement();
        ticketEmb.setNumeroTicket("GEN-EMB-20260321-BYDE-000001");
        when(ticketEmbarquementFactory.creerTicket(
                any(), any(), any(), any(), any(), any(), any(), any()))
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

    // ─── annulerReservation — CORRECTION UC-B4 (remboursement) ───────────────

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
        // CORRECTION : le remboursement doit être initié
        verify(eventPublisher).publierRemboursementDemande(
                eq(1L), eq(1L), eq(5000.0), anyString());
    }

    @Test
    void annulerReservation_etaitEnAttente_pasDRemboursement() {
        Reservation reservation = buildReservation();
        reservation.setId(1L);
        reservation.setStatut(StatutReservation.EN_ATTENTE);

        when(reservationRepository.findById(1L)).thenReturn(Optional.of(reservation));
        when(reservationRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(paiementRepository.findByReservationId(1L)).thenReturn(Optional.empty());
        when(historiqueRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        reservationService.annulerReservation(1L, 1L);

        // Pas de remboursement si la réservation n'était pas encore payée
        verify(eventPublisher, never()).publierRemboursementDemande(
                any(), any(), any(), any());
    }

    @Test
    void annulerReservation_dejaEmbarquee_leveException() {
        Reservation reservation = buildReservation();
        reservation.setId(1L);
        reservation.setStatut(StatutReservation.EMBARQUEE);

        when(reservationRepository.findById(1L)).thenReturn(Optional.of(reservation));

        assertThatThrownBy(() ->
                reservationService.annulerReservation(1L, 1L))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("embarquée");
    }

    @Test
    void annulerReservation_dejaAnnulee_leveException() {
        Reservation reservation = buildReservation();
        reservation.setId(1L);
        reservation.setStatut(StatutReservation.ANNULEE);

        when(reservationRepository.findById(1L)).thenReturn(Optional.of(reservation));

        assertThatThrownBy(() ->
                reservationService.annulerReservation(1L, 1L))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("déjà annulée");
    }

    // ─── validerBilletDepart — NOUVEAU UC-B7 ─────────────────────────────────

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

    @Test
    void validerBilletDepart_dejaValide_leveException() {
        Reservation reservation = buildReservation();
        TicketEmbarquement ticket = new TicketEmbarquement();
        ticket.setNumeroTicket("GEN-EMB-20260401-BYDE-000001");
        ticket.setStatut(StatutTicket.EMBARQUEE);
        ticket.setUtilise(true);
        ticket.setReservation(reservation);

        when(ticketRepository.findByNumeroTicket("GEN-EMB-20260401-BYDE-000001"))
                .thenReturn(Optional.of(ticket));

        assertThatThrownBy(() ->
                reservationService.validerBilletDepart(
                        "GEN-EMB-20260401-BYDE-000001", 10L))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("déjà validé");
    }

    @Test
    void validerBilletDepart_billetAnnule_leveException() {
        Reservation reservation = buildReservation();
        TicketEmbarquement ticket = new TicketEmbarquement();
        ticket.setNumeroTicket("GEN-EMB-20260401-BYDE-000001");
        ticket.setStatut(StatutTicket.ANNULE);
        ticket.setUtilise(false);
        ticket.setReservation(reservation);

        when(ticketRepository.findByNumeroTicket("GEN-EMB-20260401-BYDE-000001"))
                .thenReturn(Optional.of(ticket));

        assertThatThrownBy(() ->
                reservationService.validerBilletDepart(
                        "GEN-EMB-20260401-BYDE-000001", 10L))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("annulé");
    }

    @Test
    void validerBilletDepart_billetElectroniqueNonConverti_leveException() {
        Reservation reservation = buildReservation();
        TicketElectronique ticket = new TicketElectronique();
        ticket.setNumeroTicket("GEN-WEB-20260401-BYDE-000001");
        ticket.setStatut(StatutTicket.ACTIF);
        ticket.setUtilise(false);
        ticket.setConverti(false); // non converti !
        ticket.setReservation(reservation);

        when(ticketRepository.findByNumeroTicket("GEN-WEB-20260401-BYDE-000001"))
                .thenReturn(Optional.of(ticket));

        assertThatThrownBy(() ->
                reservationService.validerBilletDepart(
                        "GEN-WEB-20260401-BYDE-000001", 10L))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("converti");
    }

    @Test
    void validerBilletDepart_billetInexistant_leveException() {
        when(ticketRepository.findByNumeroTicket("INEXISTANT"))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() ->
                reservationService.validerBilletDepart("INEXISTANT", 10L))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("introuvable");
    }

    // ─── cloturerDepart — NOUVEAU UC-B7 ──────────────────────────────────────

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

    @Test
    void cloturerDepart_aucuneReservation_leveException() {
        when(reservationRepository.findByIdVoyage(99L)).thenReturn(Collections.emptyList());

        assertThatThrownBy(() ->
                reservationService.cloturerDepart(99L, 10L))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Aucune réservation");
    }

    // ─── getStatsFiliale — CORRECTION stats ───────────────────────────────────

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
        assertThat(stats.getReservationsConfirmees()).isEqualTo(15L); // PAYEE(10) + EMBARQUEE(5)
        assertThat(stats.getReservationsAnnulees()).isEqualTo(3L);
        assertThat(stats.getReservationsEnAttente()).isEqualTo(2L);
        assertThat(stats.getReservationsEmbarquees()).isEqualTo(5L);
        assertThat(stats.getChiffreAffairesTotal()).isEqualTo(75000.0);
        assertThat(stats.getTotalPlacesVendues()).isEqualTo(20L);
        assertThat(stats.getTauxConversion()).isGreaterThan(0.0);
    }

    @Test
    void getStatsFiliale_aucuneReservation_retourneZeros() {
        when(reservationRepository.countByStatutForFiliale("VIDE"))
                .thenReturn(List.of());
        when(reservationRepository.sumMontantByCodeFiliale("VIDE"))
                .thenReturn(0.0);
        when(reservationRepository.sumPlacesVenduesByCodeFiliale("VIDE"))
                .thenReturn(0L);

        ReservationStatsResponse stats = reservationService.getStatsFiliale("VIDE");

        assertThat(stats.getTotalReservations()).isZero();
        assertThat(stats.getTauxConversion()).isZero();
        assertThat(stats.getChiffreAffairesTotal()).isZero();
    }

    // ─── confirmerApresPaiement ───────────────────────────────────────────────

    @Test
    void confirmerApresPaiement_passeLaReservationEnPayee() {
        Reservation reservation = buildReservation();
        reservation.setId(1L);

        when(reservationRepository.findById(1L)).thenReturn(Optional.of(reservation));
        when(reservationRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(paiementRepository.findByReservationId(1L)).thenReturn(Optional.empty());
        when(fleetClient.getVoyage(1L)).thenReturn(mockVoyage);
        when(userClient.getVoyageur(1L)).thenReturn(mockVoyageur);
        when(ticketNumberGenerator.genererBilletElectronique("GEN", "BYDE"))
                .thenReturn("GEN-WEB-20260321-BYDE-000001");

        TicketElectronique ticketElec = new TicketElectronique();
        ticketElec.setNumeroTicket("GEN-WEB-20260321-BYDE-000001");
        ticketElec.setDateDepart(LocalDate.of(2026, 4, 1));
        ticketElec.setStatut(StatutTicket.ACTIF);
        ticketElec.setConverti(false);
        ticketElec.setUtilise(false);

        when(ticketElectroniqueFactory.creerTicket(
                any(), any(), any(), any(), any(), any(), any(), any()))
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

    // ─── convertirBilletElectronique ──────────────────────────────────────────

    @Test
    void convertirBilletElectronique_succes() {
        Reservation reservation = buildReservation();
        reservation.setId(1L);
        reservation.setStatut(StatutReservation.PAYEE);

        TicketElectronique ticketElec = new TicketElectronique();
        ticketElec.setId(1L);
        ticketElec.setNumeroTicket("GEN-WEB-20260321-BYDE-000001");
        ticketElec.setNomVoyageur("NGUEMBU John");
        ticketElec.setTelephoneVoyageur("+237699000001");
        ticketElec.setOrigine("Yaoundé");
        ticketElec.setDestination("Douala");
        ticketElec.setDateDepart(LocalDate.of(2026, 4, 1));
        ticketElec.setImmatriculationBus("LT-1234-A");
        ticketElec.setStatut(StatutTicket.ACTIF);
        ticketElec.setConverti(false);
        ticketElec.setUtilise(false);
        ticketElec.setReservation(reservation);

        when(ticketRepository.findByNumeroTicket("GEN-WEB-20260321-BYDE-000001"))
                .thenReturn(Optional.of(ticketElec));
        when(ticketNumberGenerator.genererBilletEmbarquement("GEN", "BYDE"))
                .thenReturn("GEN-EMB-20260321-BYDE-000002");

        TicketEmbarquement ticketEmb = new TicketEmbarquement();
        ticketEmb.setNumeroTicket("GEN-EMB-20260321-BYDE-000002");
        when(ticketEmbarquementFactory.creerTicket(
                any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(ticketEmb);
        when(ticketRepository.save(any())).thenReturn(ticketEmb);
        when(reservationRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(historiqueRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        TicketEmbarquement result = reservationService.convertirBilletElectronique(
                "GEN-WEB-20260321-BYDE-000001", 1L);

        assertThat(result.getNumeroTicket()).isEqualTo("GEN-EMB-20260321-BYDE-000002");
        assertThat(ticketElec.getConverti()).isTrue();
        assertThat(ticketElec.getStatut()).isEqualTo(StatutTicket.VERIFIE);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private ReservationRepository.StatutCount mockStatutCount(
            StatutReservation statut, long total) {
        ReservationRepository.StatutCount sc =
                mock(ReservationRepository.StatutCount.class);
        when(sc.getStatut()).thenReturn(statut);
        when(sc.getTotal()).thenReturn(total);
        return sc;
    }

    private CreerReservationRequest.MembreGroupeRequest buildMembre(
            String nom, String prenom) {
        CreerReservationRequest.MembreGroupeRequest m =
                new CreerReservationRequest.MembreGroupeRequest();
        m.setNom(nom);
        m.setPrenom(prenom);
        m.setABagage(false);
        return m;
    }
}