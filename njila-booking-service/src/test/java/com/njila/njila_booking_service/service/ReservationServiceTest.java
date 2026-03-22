package com.njila.njila_booking_service.service;

import com.njila.njila_booking_service.client.FleetServiceClient;
import com.njila.njila_booking_service.client.ServiceIndisponibleException;
import com.njila.njila_booking_service.client.UserServiceClient;
import com.njila.njila_booking_service.domain.entity.*;
import com.njila.njila_booking_service.domain.enums.*;
import com.njila.njila_booking_service.dto.request.CreerReservationRequest;
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
        mockVoyage.put("id",               1);
        mockVoyage.put("prix",             5000.0);
        mockVoyage.put("origine",          "Yaoundé");
        mockVoyage.put("destination",      "Douala");
        mockVoyage.put("dateHeureDepart",  "2026-04-01T08:00:00");
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
                .montantTotal(0.0)
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
        when(prixStandard.calculerPrix(any(), eq(5000.0), eq(1)))
                .thenReturn(5000.0);
        when(historiqueRepository.save(any()))
                .thenAnswer(i -> i.getArgument(0));

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
                .thenThrow(new ServiceIndisponibleException(
                        "fleet-service indisponible"));

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
        when(prixStandard.calculerPrix(any(), anyDouble(), anyInt()))
                .thenReturn(5000.0);
        when(historiqueRepository.save(any()))
                .thenAnswer(i -> i.getArgument(0));
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

        // Guichet → pas d'événement booking.created vers payment-service
        verify(eventPublisher, never()).publierBookingCreated(
                any(), any(), any(), any());
        // Billet d'embarquement généré directement
        verify(ticketRepository).save(any());
        // Fidélité incrémentée
        verify(fideliteService).incrementer(1L, "GEN");
    }

    @Test
    void creerReservation_groupe_avecMembres() {
        Reservation saved = buildReservation();
        saved.setId(1L);

        when(fleetClient.verifierDisponibilite(1L, 4)).thenReturn(true);
        when(reservationRepository.save(any())).thenReturn(saved);
        when(lockManager.acquerirVerrou(any(), any(), any())).thenReturn(true);
        when(fleetClient.getVoyage(1L)).thenReturn(mockVoyage);
        when(userClient.getVoyageur(1L)).thenReturn(mockVoyageur);
        when(prixGroupe.calculerPrix(any(), anyDouble(), anyInt()))
                .thenReturn(20000.0);
        when(historiqueRepository.save(any()))
                .thenAnswer(i -> i.getArgument(0));

        List<CreerReservationRequest.MembreGroupeRequest> membres = List.of(
                buildMembre("KAMGA", "Junior"),
                buildMembre("KAMGA", "Marie"),
                buildMembre("KAMGA", "Paul")
        );

        reservationService.creerReservation(
                1L, 1L, 4, CanalReservation.WEB,
                "GEN", "BYDE", null,
                CreerReservationRequest.TypeTarif.GROUPE, membres);

        verify(prixGroupe).calculerPrix(any(), eq(5000.0), eq(4));
    }

    // ─── confirmerApresPaiement ───────────────────────────────────────────────

    @Test
    void confirmerApresPaiement_passeLaReservationEnPayee() {
        Reservation reservation = buildReservation();
        reservation.setId(1L);
        reservation.setStatut(StatutReservation.EN_ATTENTE);

        when(reservationRepository.findById(1L))
                .thenReturn(Optional.of(reservation));
        when(reservationRepository.save(any()))
                .thenAnswer(i -> i.getArgument(0));
        when(paiementRepository.findByReservationId(1L))
                .thenReturn(Optional.empty());
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
        when(historiqueRepository.save(any()))
                .thenAnswer(i -> i.getArgument(0));

        reservationService.confirmerApresPaiement(1L, "TXN-001");

        assertThat(reservation.getStatut()).isEqualTo(StatutReservation.PAYEE);
        verify(fideliteService).incrementer(1L, "GEN");
        verify(lockManager).libererVerrou(1L, 1L);
        verify(eventPublisher).publierTicketGenerated(
                any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void confirmerApresPaiement_reservationIntrouvable_leveException() {
        when(reservationRepository.findById(99L))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() ->
                reservationService.confirmerApresPaiement(99L, "TXN-001"))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("introuvable");
    }

    // ─── annulerApresEchecPaiement ────────────────────────────────────────────

    @Test
    void annulerApresEchecPaiement_passeLaReservationEnAnnulee() {
        Reservation reservation = buildReservation();
        reservation.setId(1L);

        when(reservationRepository.findById(1L))
                .thenReturn(Optional.of(reservation));
        when(reservationRepository.save(any()))
                .thenAnswer(i -> i.getArgument(0));
        when(paiementRepository.findByReservationId(1L))
                .thenReturn(Optional.empty());
        when(historiqueRepository.save(any()))
                .thenAnswer(i -> i.getArgument(0));

        reservationService.annulerApresEchecPaiement(1L);

        assertThat(reservation.getStatut()).isEqualTo(StatutReservation.ANNULEE);
        verify(lockManager).libererVerrou(1L, 1L);
    }

    // ─── annulerReservation ───────────────────────────────────────────────────

    @Test
    void annulerReservation_succes() {
        Reservation reservation = buildReservation();
        reservation.setId(1L);
        reservation.setStatut(StatutReservation.EN_ATTENTE);

        when(reservationRepository.findById(1L))
                .thenReturn(Optional.of(reservation));
        when(reservationRepository.save(any()))
                .thenAnswer(i -> i.getArgument(0));
        when(historiqueRepository.save(any()))
                .thenAnswer(i -> i.getArgument(0));

        Reservation result = reservationService.annulerReservation(1L, 1L);

        assertThat(result.getStatut()).isEqualTo(StatutReservation.ANNULEE);
        verify(lockManager).libererVerrou(1L, 1L);
    }

    @Test
    void annulerReservation_dejaEmbarquee_leveException() {
        Reservation reservation = buildReservation();
        reservation.setId(1L);
        reservation.setStatut(StatutReservation.EMBARQUEE);

        when(reservationRepository.findById(1L))
                .thenReturn(Optional.of(reservation));

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

        when(reservationRepository.findById(1L))
                .thenReturn(Optional.of(reservation));

        assertThatThrownBy(() ->
                reservationService.annulerReservation(1L, 1L))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("déjà annulée");
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
        when(reservationRepository.save(any()))
                .thenAnswer(i -> i.getArgument(0));
        when(historiqueRepository.save(any()))
                .thenAnswer(i -> i.getArgument(0));

        TicketEmbarquement result = reservationService
                .convertirBilletElectronique(
                        "GEN-WEB-20260321-BYDE-000001", 1L);

        assertThat(result.getNumeroTicket())
                .isEqualTo("GEN-EMB-20260321-BYDE-000002");
        assertThat(ticketElec.getConverti()).isTrue();
        assertThat(ticketElec.getStatut()).isEqualTo(StatutTicket.VERIFIE);
    }

    @Test
    void convertirBilletElectronique_billetInexistant_leveException() {
        when(ticketRepository.findByNumeroTicket("INEXISTANT"))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() ->
                reservationService.convertirBilletElectronique(
                        "INEXISTANT", 1L))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("introuvable");
    }

    @Test
    void convertirBilletElectronique_dejaConverti_leveException() {
        Reservation reservation = buildReservation();
        TicketElectronique ticketElec = new TicketElectronique();
        ticketElec.setConverti(true);   // déjà converti
        ticketElec.setStatut(StatutTicket.VERIFIE);
        ticketElec.setUtilise(false);
        ticketElec.setReservation(reservation);

        when(ticketRepository.findByNumeroTicket("GEN-WEB-20260321-BYDE-000001"))
                .thenReturn(Optional.of(ticketElec));

        assertThatThrownBy(() ->
                reservationService.convertirBilletElectronique(
                        "GEN-WEB-20260321-BYDE-000001", 1L))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("invalide");
    }

    // ─── getters ──────────────────────────────────────────────────────────────

    @Test
    void getReservation_existante_retourneReservation() {
        Reservation reservation = buildReservation();
        reservation.setId(1L);
        when(reservationRepository.findById(1L))
                .thenReturn(Optional.of(reservation));

        Reservation result = reservationService.getReservation(1L);
        assertThat(result.getId()).isEqualTo(1L);
    }

    @Test
    void getReservation_inexistante_leveException() {
        when(reservationRepository.findById(99L))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> reservationService.getReservation(99L))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("introuvable");
    }

    @Test
    void getReservationsVoyage_retourneListe() {
        Reservation r1 = buildReservation();
        Reservation r2 = buildReservation();
        when(reservationRepository.findByIdVoyage(1L))
                .thenReturn(List.of(r1, r2));

        List<Reservation> result = reservationService.getReservationsVoyage(1L);
        assertThat(result).hasSize(2);
    }

    @Test
    void getReservationsVoyageur_retourneListe() {
        Reservation r1 = buildReservation();
        when(reservationRepository.findByIdVoyageur(1L))
                .thenReturn(List.of(r1));

        List<Reservation> result = reservationService.getReservationsVoyageur(1L);
        assertThat(result).hasSize(1);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

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