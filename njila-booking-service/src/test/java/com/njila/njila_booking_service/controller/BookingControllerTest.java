package com.njila.njila_booking_service.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.njila.njila_booking_service.domain.entity.*;
import com.njila.njila_booking_service.domain.enums.*;
import com.njila.njila_booking_service.dto.request.*;
import com.njila.njila_booking_service.dto.response.ReservationStatsResponse;
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
import java.util.Map;

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
        mockReservation.setIdVoyage("voyage-1");
        mockReservation.setIdVoyageur("user-1");
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

    // ─── POST /api/bookings ───────────────────────────────────────────────────

    @Test
    void creerReservation_retourne200() throws Exception {
        CreerReservationRequest request = new CreerReservationRequest();
        request.setIdVoyage("voyage-1");
        request.setIdVoyageur("user-1");
        // FIX : nomVoyageur et prenomVoyageur sont @NotBlank — obligatoires
        request.setNomVoyageur("NGUEMBU");
        request.setPrenomVoyageur("John");
        request.setNombrePlaces(1);
        request.setCanal(CanalReservation.WEB);
        request.setCodeAgence("GEN");
        request.setCodeFiliale("BYDE");
        request.setTypeTarif(CreerReservationRequest.TypeTarif.STANDARD);

        // 18 paramètres correspondant exactement à la signature de creerReservation :
        // (String idVoyage, String idVoyageur, String nom, String prenom,
        //  String tel, String email, int nombrePlaces, CanalReservation canal,
        //  String codeAgence, String codeFiliale, String idGuichetier,
        //  TypeTarif typeTarif, List<MembreGroupeRequest> membres,
        //  List<Integer> sieges, String devise, String paymentMethodType,
        //  String telephonePaiement, String operateurPaiement)
        when(reservationService.creerReservation(
                any(),      // idVoyage
                any(),      // idVoyageur
                any(),      // nomVoyageur
                any(),      // prenomVoyageur
                any(),      // telephoneVoyageur
                any(),      // emailVoyageur
                anyInt(),   // nombrePlaces
                any(),      // CanalReservation
                any(),      // codeAgence
                any(),      // codeFiliale
                any(),      // idGuichetier
                any(),      // TypeTarif
                any(),      // membresGroupe
                any(),      // siegesDemandes
                any(),      // devise
                any(),      // paymentMethodType
                any(),      // telephonePaiement
                any()       // operateurPaiement
        )).thenReturn(mockReservation);

        mockMvc.perform(post("/api/bookings")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.statut").value("EN_ATTENTE"))
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
        when(reservationService.getReservation(1L)).thenReturn(mockReservation);

        mockMvc.perform(get("/api/bookings/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1));
    }

    @Test
    void getReservation_inexistante_retourne404() throws Exception {
        when(reservationService.getReservation(99L))
                .thenThrow(new RuntimeException("Réservation introuvable : 99"));

        mockMvc.perform(get("/api/bookings/99"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404));
    }

    // ─── PATCH /api/bookings/{id}/cancel ─────────────────────────────────────

    @Test
    void annuler_succes_retourne200() throws Exception {
        mockReservation.setStatut(StatutReservation.ANNULEE);
        when(reservationService.annulerReservation(1L, "user-1"))
                .thenReturn(mockReservation);

        mockMvc.perform(patch("/api/bookings/1/cancel")
                        .param("idUtilisateur", "user-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.statut").value("ANNULEE"));
    }

    @Test
    void annuler_reservationEmbarquee_retourne400() throws Exception {
        when(reservationService.annulerReservation(1L, "user-1"))
                .thenThrow(new RuntimeException(
                        "Impossible d'annuler une réservation déjà embarquée."));

        mockMvc.perform(patch("/api/bookings/1/cancel")
                        .param("idUtilisateur", "user-1"))
                .andExpect(status().isBadRequest());
    }

    // ─── GET /api/bookings/stats/{filialeId} ─────────────────────────────────

    @Test
    void getStats_retourneMetriquesAgregees() throws Exception {
        ReservationStatsResponse stats = ReservationStatsResponse.builder()
                .filialeId("filiale-1")
                .totalReservations(20)
                .reservationsConfirmees(15)
                .reservationsAnnulees(3)
                .reservationsEnAttente(2)
                .reservationsEmbarquees(5)
                .totalPlacesVendues(18)
                .chiffreAffairesTotal(75000.0)
                .tauxConversion(75.0)
                .build();

        when(reservationService.getStatsFiliale("BYDE")).thenReturn(stats);

        mockMvc.perform(get("/api/bookings/stats/filiale-1")
                        .param("codeFiliale", "BYDE"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.filialeId").value("filiale-1"))
                .andExpect(jsonPath("$.totalReservations").value(20))
                .andExpect(jsonPath("$.chiffreAffairesTotal").value(75000.0))
                .andExpect(jsonPath("$.tauxConversion").value(75.0));
    }

    // ─── POST /api/bookings/depart/valider-billet ─────────────────────────────

    @Test
    void validerBilletDepart_retourne200() throws Exception {
        TicketEmbarquement ticket = new TicketEmbarquement();
        ticket.setId(1L);
        ticket.setNumeroTicket("GEN-EMB-20260401-BYDE-000001");
        ticket.setStatut(StatutTicket.EMBARQUEE);
        ticket.setNomVoyageur("NGUEMBU John");
        ticket.setOrigine("Yaoundé");
        ticket.setDestination("Douala");
        ticket.setDateDepart(LocalDate.of(2026, 4, 1));
        ticket.setImmatriculationBus("LT-1234-A");
        ticket.setTelephoneVoyageur("+237699000001");
        ticket.setUtilise(true);

        when(reservationService.validerBilletDepart(
                "GEN-EMB-20260401-BYDE-000001", "manager-10"))
                .thenReturn(ticket);

        ValiderBilletDepartRequest request = new ValiderBilletDepartRequest();
        request.setNumeroBillet("GEN-EMB-20260401-BYDE-000001");
        request.setIdManager("manager-10");

        mockMvc.perform(post("/api/bookings/depart/valider-billet")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.statut").value("EMBARQUEE"))
                .andExpect(jsonPath("$.type").value("EMB"));
    }

    @Test
    void validerBilletDepart_billetDejaValide_retourne400() throws Exception {
        when(reservationService.validerBilletDepart(any(), any()))
                .thenThrow(new RuntimeException(
                        "Ce billet est déjà validé : GEN-EMB-20260401-BYDE-000001"));

        ValiderBilletDepartRequest request = new ValiderBilletDepartRequest();
        request.setNumeroBillet("GEN-EMB-20260401-BYDE-000001");
        request.setIdManager("manager-10");

        mockMvc.perform(post("/api/bookings/depart/valider-billet")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    // ─── POST /api/bookings/depart/cloturer ──────────────────────────────────

    @Test
    void cloturerDepart_retourne200AvecSynthese() throws Exception {
        Map<String, Object> resultat = Map.of(
                "voyageId",           "voyage-1",
                "passagersEmbarques", 25L,
                "totalConfirmees",    28L,
                "totalPlaces",        30,
                "statut",             "DEPART_CLOTURE"
        );
        when(reservationService.cloturerDepart("voyage-1", "manager-10"))
                .thenReturn(resultat);

        mockMvc.perform(post("/api/bookings/depart/cloturer")
                        .param("idVoyage", "voyage-1")
                        .param("idManager", "manager-10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.statut").value("DEPART_CLOTURE"))
                .andExpect(jsonPath("$.passagersEmbarques").value(25));
    }

    // ─── GET /api/bookings/history/{userId} ──────────────────────────────────

    @Test
    void getHistorique_retourne200AvecListe() throws Exception {
        when(reservationService.getReservationsVoyageur("user-1"))
                .thenReturn(List.of(mockReservation));

        mockMvc.perform(get("/api/bookings/history/user-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));
    }

    // ─── GET /api/bookings/fidelite/{idVoyageur} ─────────────────────────────

    @Test
    void getFidelite_retourne200AvecCompteur() throws Exception {
        when(fideliteService.getNombreVoyages("user-1", "GEN")).thenReturn(7);
        when(fideliteService.estVoyageGratuit("user-1", "GEN")).thenReturn(false);

        mockMvc.perform(get("/api/bookings/fidelite/user-1")
                        .param("codeAgence", "GEN"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nombreVoyages").value(7))
                .andExpect(jsonPath("$.voyagesRestants").value(3));
    }

    @Test
    void getFidelite_voyageGratuit_retourneMessage() throws Exception {
        when(fideliteService.getNombreVoyages("user-1", "GEN")).thenReturn(10);
        when(fideliteService.estVoyageGratuit("user-1", "GEN")).thenReturn(true);

        mockMvc.perform(get("/api/bookings/fidelite/user-1")
                        .param("codeAgence", "GEN"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.voyageGratuit").value(true))
                .andExpect(jsonPath("$.message")
                        .value("Votre prochain voyage est GRATUIT !"));
    }

    // ─── GET /api/bookings/{id}/ticket/pdf ───────────────────────────────────

    @Test
    void telechargerPdf_retournePdf() throws Exception {
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

        when(reservationService.getReservation(1L)).thenReturn(mockReservation);
        when(pdfGeneratorService.lirePdf("GEN-WEB-20260321-BYDE-000001"))
                .thenReturn(new byte[]{37, 80, 68, 70}); // %PDF

        mockMvc.perform(get("/api/bookings/1/ticket/pdf"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_PDF));
    }

    @Test
    void telechargerPdf_aucunBilletElectronique_retourne400() throws Exception {
        when(reservationService.getReservation(1L)).thenReturn(mockReservation);

        mockMvc.perform(get("/api/bookings/1/ticket/pdf"))
                .andExpect(status().isBadRequest());
    }
}