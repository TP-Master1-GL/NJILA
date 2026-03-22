package com.njila.njila_booking_service.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.njila.njila_booking_service.domain.entity.*;
import com.njila.njila_booking_service.domain.enums.*;
import com.njila.njila_booking_service.dto.request.CreerReservationRequest;
import com.njila.njila_booking_service.repository.TicketRepository;
import com.njila.njila_booking_service.service.FideliteService;
import com.njila.njila_booking_service.service.PdfGeneratorService;
import com.njila.njila_booking_service.service.ReservationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(BookingController.class)
class BookingControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean private ReservationService  reservationService;
    @MockBean private FideliteService     fideliteService;
    @MockBean private PdfGeneratorService pdfGeneratorService;
    @MockBean private TicketRepository    ticketRepository;

    private Reservation mockReservation;

    @BeforeEach
    void setUp() {
        mockReservation = new Reservation();
        mockReservation.setId(1L);
        mockReservation.setIdVoyage(1L);
        mockReservation.setIdVoyageur(1L);
        mockReservation.setNombrePlaces(1);
        mockReservation.setCanal(CanalReservation.WEB);
        mockReservation.setCodeAgence("GEN");
        mockReservation.setCodeFiliale("BYDE");
        mockReservation.setStatut(StatutReservation.EN_ATTENTE);
        mockReservation.setMontantTotal(5000.0);
        mockReservation.setTickets(new ArrayList<>());
        mockReservation.setPlacesReservees(new ArrayList<>());
        mockReservation.setHistorique(new ArrayList<>());
    }

    private CreerReservationRequest buildRequest() {
        CreerReservationRequest request = new CreerReservationRequest();
        request.setIdVoyage(1L);
        request.setIdVoyageur(1L);
        request.setNombrePlaces(1);
        request.setCanal(CanalReservation.WEB);
        request.setCodeAgence("GEN");
        request.setCodeFiliale("BYDE");
        request.setTypeTarif(CreerReservationRequest.TypeTarif.STANDARD);
        return request;
    }

    // ─── POST /api/bookings ───────────────────────────────────────────────────

    @Test
    void creerReservation_retourne200() throws Exception {
        when(reservationService.creerReservation(
                eq(1L), eq(1L), eq(1),
                eq(CanalReservation.WEB),
                eq("GEN"), eq("BYDE"),
                isNull(),
                eq(CreerReservationRequest.TypeTarif.STANDARD),
                isNull()))
                .thenReturn(mockReservation);

        mockMvc.perform(post("/api/bookings")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(buildRequest())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.statut").value("EN_ATTENTE"))
                .andExpect(jsonPath("$.codeAgence").value("GEN"))
                .andExpect(jsonPath("$.montantTotal").value(5000.0));
    }

    @Test
    void creerReservation_champManquant_retourne400() throws Exception {
        mockMvc.perform(post("/api/bookings")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());
    }

    // ─── GET /api/bookings/{id} ───────────────────────────────────────────────

    @Test
    void getReservation_existante_retourne200() throws Exception {
        when(reservationService.getReservation(1L))
                .thenReturn(mockReservation);

        mockMvc.perform(get("/api/bookings/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1));
    }

    @Test
    void getReservation_inexistante_retourne404() throws Exception {
        when(reservationService.getReservation(99L))
                .thenThrow(new RuntimeException(
                        "Réservation introuvable : 99"));

        mockMvc.perform(get("/api/bookings/99"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404));
    }

    // ─── GET /api/bookings/voyage/{voyageId} ──────────────────────────────────

    @Test
    void getReservationsVoyage_retourne200AvecListe() throws Exception {
        when(reservationService.getReservationsVoyage(1L))
                .thenReturn(List.of(mockReservation));

        mockMvc.perform(get("/api/bookings/voyage/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));
    }

    // ─── GET /api/bookings/history/{userId} ───────────────────────────────────

    @Test
    void getHistorique_retourne200AvecListe() throws Exception {
        when(reservationService.getReservationsVoyageur(1L))
                .thenReturn(List.of(mockReservation));

        mockMvc.perform(get("/api/bookings/history/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));
    }

    // ─── PATCH /api/bookings/{id}/cancel ─────────────────────────────────────

    @Test
    void annuler_succes_retourne200() throws Exception {
        mockReservation.setStatut(StatutReservation.ANNULEE);
        when(reservationService.annulerReservation(1L, 1L))
                .thenReturn(mockReservation);

        mockMvc.perform(patch("/api/bookings/1/cancel")
                        .param("idUtilisateur", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.statut").value("ANNULEE"));
    }

    @Test
    void annuler_reservationEmbarquee_retourne400() throws Exception {
        when(reservationService.annulerReservation(1L, 1L))
                .thenThrow(new RuntimeException(
                        "Impossible d'annuler une réservation déjà embarquée."));

        mockMvc.perform(patch("/api/bookings/1/cancel")
                        .param("idUtilisateur", "1"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(
                        "Impossible d'annuler une réservation déjà embarquée."));
    }

    // ─── GET /api/bookings/fidelite/{idVoyageur} ─────────────────────────────

    @Test
    void getFidelite_retourne200AvecCompteur() throws Exception {
        when(fideliteService.getNombreVoyages(1L, "GEN")).thenReturn(7);
        when(fideliteService.estVoyageGratuit(1L, "GEN")).thenReturn(false);

        mockMvc.perform(get("/api/bookings/fidelite/1")
                        .param("codeAgence", "GEN"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nombreVoyages").value(7))
                .andExpect(jsonPath("$.voyageGratuit").value(false))
                .andExpect(jsonPath("$.voyagesRestants").value(3));
    }

    @Test
    void getFidelite_voyageGratuit_retourneMessage() throws Exception {
        when(fideliteService.getNombreVoyages(1L, "GEN")).thenReturn(10);
        when(fideliteService.estVoyageGratuit(1L, "GEN")).thenReturn(true);

        mockMvc.perform(get("/api/bookings/fidelite/1")
                        .param("codeAgence", "GEN"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.voyageGratuit").value(true))
                .andExpect(jsonPath("$.voyagesRestants").value(0))
                .andExpect(jsonPath("$.message").value(
                        "Votre prochain voyage est GRATUIT !"));
    }

    // ─── GET /api/bookings/{id}/ticket/pdf ───────────────────────────────────

    @Test
    void telechargerPdf_billetElectroniqueExistant_retournePdf()
            throws Exception {
        TicketElectronique ticketElec = new TicketElectronique();
        ticketElec.setId(1L);
        ticketElec.setNumeroTicket("GEN-WEB-20260321-BYDE-000001");
        ticketElec.setStatut(StatutTicket.ACTIF);
        ticketElec.setConverti(false);
        ticketElec.setUtilise(false);
        ticketElec.setNomVoyageur("NGUEMBU John");
        ticketElec.setOrigine("Yaoundé");
        ticketElec.setDestination("Douala");
        ticketElec.setDateDepart(LocalDate.of(2026, 4, 1));
        ticketElec.setImmatriculationBus("LT-1234-A");
        ticketElec.setTelephoneVoyageur("+237699000001");

        mockReservation.getTickets().add(ticketElec);

        when(reservationService.getReservation(1L))
                .thenReturn(mockReservation);
        when(pdfGeneratorService.lirePdf(
                "GEN-WEB-20260321-BYDE-000001"))
                .thenReturn(new byte[]{37, 80, 68, 70}); // %PDF

        mockMvc.perform(get("/api/bookings/1/ticket/pdf"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_PDF));
    }

    @Test
    void telechargerPdf_aucunBilletElectronique_retourne400()
            throws Exception {
        // Pas de ticket électronique dans la réservation
        when(reservationService.getReservation(1L))
                .thenReturn(mockReservation);

        mockMvc.perform(get("/api/bookings/1/ticket/pdf"))
                .andExpect(status().isBadRequest());
    }
}
