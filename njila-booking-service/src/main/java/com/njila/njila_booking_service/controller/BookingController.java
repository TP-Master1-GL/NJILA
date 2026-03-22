package com.njila.njila_booking_service.controller;

import com.njila.njila_booking_service.domain.entity.*;
import com.njila.njila_booking_service.dto.request.*;
import com.njila.njila_booking_service.dto.response.*;
import com.njila.njila_booking_service.repository.TicketRepository;
import com.njila.njila_booking_service.service.FideliteService;
import com.njila.njila_booking_service.service.PdfGeneratorService;
import com.njila.njila_booking_service.service.ReservationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/bookings")
@RequiredArgsConstructor
@Slf4j
public class BookingController {

    private final ReservationService reservationService;
    private final FideliteService    fideliteService;
    private final PdfGeneratorService pdfGeneratorService;
    private final TicketRepository   ticketRepository;

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/bookings — Créer une réservation
    // ─────────────────────────────────────────────────────────────────────────

    @PostMapping
    public ResponseEntity<ReservationResponse> creerReservation(
            @Valid @RequestBody CreerReservationRequest request) {

        Reservation reservation = reservationService.creerReservation(
                request.getIdVoyage(),
                request.getIdVoyageur(),
                request.getNombrePlaces(),
                request.getCanal(),
                request.getCodeAgence(),
                request.getCodeFiliale(),
                request.getIdGuichetier(),
                request.getTypeTarif(),
                request.getMembresGroupe()
        );
        return ResponseEntity.ok(toResponse(reservation));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/bookings/{id} — Détail d'une réservation
    // ─────────────────────────────────────────────────────────────────────────

    @GetMapping("/{id}")
    public ResponseEntity<ReservationResponse> getReservation(
            @PathVariable Long id) {
        return ResponseEntity.ok(
                toResponse(reservationService.getReservation(id)));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/bookings/voyage/{voyageId} — Réservations d'un voyage
    // ─────────────────────────────────────────────────────────────────────────

    @GetMapping("/voyage/{voyageId}")
    public ResponseEntity<List<ReservationResponse>> getReservationsVoyage(
            @PathVariable Long voyageId) {
        return ResponseEntity.ok(
                reservationService.getReservationsVoyage(voyageId)
                        .stream()
                        .map(this::toResponse)
                        .toList()
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/bookings/history/{userId} — Historique d'un voyageur
    // ─────────────────────────────────────────────────────────────────────────

    @GetMapping("/history/{userId}")
    public ResponseEntity<List<ReservationResponse>> getHistorique(
            @PathVariable Long userId) {
        return ResponseEntity.ok(
                reservationService.getReservationsVoyageur(userId)
                        .stream()
                        .map(this::toResponse)
                        .toList()
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/bookings/stats/{filialeId} — Statistiques d'une filiale
    // ─────────────────────────────────────────────────────────────────────────

    @GetMapping("/stats/{filialeId}")
    public ResponseEntity<List<ReservationResponse>> getStats(
            @PathVariable Long filialeId) {
        return ResponseEntity.ok(
                reservationService.getReservationsVoyage(filialeId)
                        .stream()
                        .map(this::toResponse)
                        .toList()
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PATCH /api/bookings/{id}/cancel — Annuler une réservation
    // ─────────────────────────────────────────────────────────────────────────

    @PatchMapping("/{id}/cancel")
    public ResponseEntity<ReservationResponse> annuler(
            @PathVariable Long id,
            @RequestParam Long idUtilisateur) {
        return ResponseEntity.ok(
                toResponse(reservationService.annulerReservation(id, idUtilisateur))
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PATCH /api/bookings/{id}/confirm
    // Guichetier saisit le numéro unique du billet électronique
    // → génère et imprime le billet d'embarquement
    // ─────────────────────────────────────────────────────────────────────────

    @PatchMapping("/{id}/confirm")
    public ResponseEntity<TicketResponse> confirmer(
            @PathVariable Long id,
            @Valid @RequestBody ConfirmerReservationRequest request) {

        TicketEmbarquement ticket = reservationService.convertirBilletElectronique(
                request.getNumeroTicketElectronique(),
                request.getIdGuichetier()
        );
        return ResponseEntity.ok(toTicketResponse(ticket, "EMB"));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/bookings/{id}/ticket — Infos JSON du billet
    // ─────────────────────────────────────────────────────────────────────────

    @GetMapping("/{id}/ticket")
    public ResponseEntity<TicketResponse> getTicket(@PathVariable Long id) {
        Reservation reservation = reservationService.getReservation(id);

        Ticket ticket = reservation.getTickets()
                .stream()
                .filter(t -> t instanceof TicketElectronique)
                .findFirst()
                .orElse(reservation.getTickets()
                        .stream()
                        .findFirst()
                        .orElseThrow(() -> new RuntimeException(
                                "Aucun billet trouvé pour la réservation " + id)));

        String type = (ticket instanceof TicketElectronique) ? "WEB" : "EMB";
        return ResponseEntity.ok(toTicketResponse(ticket, type));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/bookings/{id}/ticket/pdf — Télécharger le billet PDF
    // Uniquement pour les billets électroniques (réservation WEB)
    // ─────────────────────────────────────────────────────────────────────────

    @GetMapping("/{id}/ticket/pdf")
    public ResponseEntity<byte[]> telechargerBilletPdf(@PathVariable Long id) {

        // 1. Récupérer la réservation
        Reservation reservation = reservationService.getReservation(id);

        // 2. Trouver le billet électronique
        TicketElectronique ticketElec = reservation.getTickets()
                .stream()
                .filter(t -> t instanceof TicketElectronique)
                .map(t -> (TicketElectronique) t)
                .findFirst()
                .orElseThrow(() -> new RuntimeException(
                        "Aucun billet électronique trouvé pour la réservation "
                        + id + ". Ce billet est peut-être un billet guichet."));

        // 3. Lire le PDF depuis le disque
        try {
            byte[] pdf = pdfGeneratorService.lirePdf(ticketElec.getNumeroTicket());

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_PDF);
            headers.setContentDispositionFormData(
                    "attachment",
                    "billet-" + ticketElec.getNumeroTicket() + ".pdf"
            );
            headers.setContentLength(pdf.length);

            log.info("[CONTROLLER] Téléchargement billet PDF : {}",
                    ticketElec.getNumeroTicket());

            return ResponseEntity.ok()
                    .headers(headers)
                    .body(pdf);

        } catch (Exception e) {
            throw new RuntimeException(
                    "Impossible de récupérer le PDF : " + e.getMessage());
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/bookings/fidelite/{idVoyageur} — Compteur fidélité
    // ─────────────────────────────────────────────────────────────────────────

    @GetMapping("/fidelite/{idVoyageur}")
    public ResponseEntity<Map<String, Object>> getFidelite(
            @PathVariable Long idVoyageur,
            @RequestParam String codeAgence) {

        int     nombreVoyages   = fideliteService.getNombreVoyages(
                idVoyageur, codeAgence);
        boolean voyageGratuit   = fideliteService.estVoyageGratuit(
                idVoyageur, codeAgence);
        int     voyagesRestants = voyageGratuit ? 0
                : 10 - (nombreVoyages % 10);

        return ResponseEntity.ok(Map.of(
                "idVoyageur",      idVoyageur,
                "codeAgence",      codeAgence,
                "nombreVoyages",   nombreVoyages,
                "voyageGratuit",   voyageGratuit,
                "voyagesRestants", voyagesRestants,
                "message",         voyageGratuit
                        ? "Votre prochain voyage est GRATUIT !"
                        : "Encore " + voyagesRestants
                          + " voyage(s) pour obtenir un voyage gratuit."
        ));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MAPPERS
    // ─────────────────────────────────────────────────────────────────────────

    private ReservationResponse toResponse(Reservation r) {
        return ReservationResponse.builder()
                .id(r.getId())
                .statut(r.getStatut())
                .nombrePlaces(r.getNombrePlaces())
                .montantTotal(r.getMontantTotal())
                .canal(r.getCanal())
                .idVoyage(r.getIdVoyage())
                .idVoyageur(r.getIdVoyageur())
                .dateReservation(r.getDateReservation())
                .codeAgence(r.getCodeAgence())
                .codeFiliale(r.getCodeFiliale())
                .build();
    }

    private TicketResponse toTicketResponse(Ticket t, String type) {
        String cheminPdf = (t instanceof TicketElectronique te)
                ? te.getCheminPdf() : null;
        return TicketResponse.builder()
                .id(t.getId())
                .numeroTicket(t.getNumeroTicket())
                .type(type)
                .nomVoyageur(t.getNomVoyageur())
                .origine(t.getOrigine())
                .destination(t.getDestination())
                .dateDepart(t.getDateDepart())
                .immatriculationBus(t.getImmatriculationBus())
                .statut(t.getStatut())
                .dateEmission(t.getDateEmission())
                .cheminPdf(cheminPdf)
                .build();
    }
}