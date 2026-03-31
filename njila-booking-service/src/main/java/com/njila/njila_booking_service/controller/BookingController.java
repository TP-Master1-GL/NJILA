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

    private final ReservationService  reservationService;
    private final FideliteService     fideliteService;
    private final PdfGeneratorService pdfGeneratorService;
    private final TicketRepository    ticketRepository;

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
    // CORRECTION S6 — GET /api/bookings/stats/{filialeId}
    //
    // Ancienne implémentation : appelait getReservationsVoyage(filialeId)
    // → confusion voyage/filiale, pas de métriques agrégées.
    //
    // Nouvelle implémentation : stats réelles via codeFiliale
    // (le codeFiliale est fourni en query param car filialeId numérique
    //  doit être résolu en code métier pour requêter la table reservations).
    // ─────────────────────────────────────────────────────────────────────────

    @GetMapping("/stats/{filialeId}")
    public ResponseEntity<ReservationStatsResponse> getStats(
            @PathVariable Long filialeId,
            @RequestParam String codeFiliale) {

        ReservationStatsResponse stats =
                reservationService.getStatsFiliale(codeFiliale);

        // Enrichir avec l'ID numérique passé en path
        ReservationStatsResponse enrichi = ReservationStatsResponse.builder()
                .filialeId(filialeId)
                .totalReservations(stats.getTotalReservations())
                .reservationsConfirmees(stats.getReservationsConfirmees())
                .reservationsAnnulees(stats.getReservationsAnnulees())
                .reservationsEnAttente(stats.getReservationsEnAttente())
                .reservationsEmbarquees(stats.getReservationsEmbarquees())
                .totalPlacesVendues(stats.getTotalPlacesVendues())
                .chiffreAffairesTotal(stats.getChiffreAffairesTotal())
                .tauxConversion(stats.getTauxConversion())
                .build();

        return ResponseEntity.ok(enrichi);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PATCH /api/bookings/{id}/cancel — Annuler une réservation
    // UC-B4 : la postcondition "Remboursement initié" est maintenant assurée
    // par ReservationService qui publie booking.refund.requested si PAYEE.
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
    // CORRECTION S6 — PATCH /api/bookings/{id}/confirm
    //
    // Ancienne sémantique : conversion billet électronique → embarquement
    // (confusionnait deux opérations distinctes).
    //
    // Nouvelle sémantique conforme au document S6 :
    //   "Confirmer une réservation (paiement en espèces sur site)"
    //   Acteurs : Guichetier / Manager
    //   Précondition : Réservation en statut EN_ATTENTE
    //   Postcondition : Réservation confirmée. Billet d'embarquement généré.
    //
    // La conversion billet électronique reste disponible via /convert-ticket.
    // ─────────────────────────────────────────────────────────────────────────

    @PatchMapping("/{id}/confirm")
    public ResponseEntity<TicketResponse> confirmerPaiementEspeces(
            @PathVariable Long id,
            @Valid @RequestBody ConfirmerPaiementEspecesRequest request) {

        TicketEmbarquement ticket = reservationService.confirmerPaiementEspeces(
                id,
                request.getIdGuichetier(),
                request.getMontantEncaisse()
        );
        return ResponseEntity.ok(toTicketResponse(ticket, "EMB"));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PATCH /api/bookings/{id}/convert-ticket
    // Conversion billet électronique → billet d'embarquement au guichet
    // (déplacé depuis /confirm pour clarifier la sémantique)
    // ─────────────────────────────────────────────────────────────────────────

    @PatchMapping("/{id}/convert-ticket")
    public ResponseEntity<TicketResponse> convertirBilletElectronique(
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
    // ─────────────────────────────────────────────────────────────────────────

    @GetMapping("/{id}/ticket/pdf")
    public ResponseEntity<byte[]> telechargerBilletPdf(@PathVariable Long id) {

        Reservation reservation = reservationService.getReservation(id);

        TicketElectronique ticketElec = reservation.getTickets()
                .stream()
                .filter(t -> t instanceof TicketElectronique)
                .map(t -> (TicketElectronique) t)
                .findFirst()
                .orElseThrow(() -> new RuntimeException(
                        "Aucun billet électronique trouvé pour la réservation "
                        + id + ". Ce billet est peut-être un billet guichet."));

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
    // NOUVEAU UC-B7 — POST /api/bookings/depart/valider-billet
    // Valider un billet au moment de l'embarquement
    // Acteur : Manager local
    // ─────────────────────────────────────────────────────────────────────────

    @PostMapping("/depart/valider-billet")
    public ResponseEntity<TicketResponse> validerBilletDepart(
            @Valid @RequestBody ValiderBilletDepartRequest request) {

        Ticket ticket = reservationService.validerBilletDepart(
                request.getNumeroBillet(),
                request.getIdManager()
        );
        String type = (ticket instanceof TicketElectronique) ? "WEB" : "EMB";
        return ResponseEntity.ok(toTicketResponse(ticket, type));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // NOUVEAU UC-B7 — POST /api/bookings/depart/cloturer
    // Clôturer le départ d'un voyage (après validation de tous les billets)
    // Acteur : Manager local
    // ─────────────────────────────────────────────────────────────────────────

    @PostMapping("/depart/cloturer")
    public ResponseEntity<Map<String, Object>> cloturerDepart(
            @RequestParam Long idVoyage,
            @RequestParam Long idManager) {

        Map<String, Object> resultat =
                reservationService.cloturerDepart(idVoyage, idManager);

        return ResponseEntity.ok(resultat);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/bookings/fidelite/{idVoyageur} — Compteur fidélité
    // ─────────────────────────────────────────────────────────────────────────

    @GetMapping("/fidelite/{idVoyageur}")
    public ResponseEntity<Map<String, Object>> getFidelite(
            @PathVariable Long idVoyageur,
            @RequestParam String codeAgence) {

        int nombreVoyages   = fideliteService.getNombreVoyages(idVoyageur, codeAgence);
        boolean voyageGratuit = fideliteService.estVoyageGratuit(idVoyageur, codeAgence);
        int voyagesRestants = voyageGratuit ? 0 : 10 - (nombreVoyages % 10);

        return ResponseEntity.ok(Map.of(
                "idVoyageur",      idVoyageur,
                "codeAgence",      codeAgence,
                "nombreVoyages",   nombreVoyages,
                "voyageGratuit",   voyageGratuit,
                "voyagesRestants", voyagesRestants,
                "message", voyageGratuit
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