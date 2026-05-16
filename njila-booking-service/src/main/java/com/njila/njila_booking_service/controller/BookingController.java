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
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/bookings")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Réservations", description = "API de gestion des réservations et billets")
public class BookingController {

    private final ReservationService reservationService;
    private final FideliteService fideliteService;
    private final PdfGeneratorService pdfGeneratorService;
    private final TicketRepository ticketRepository;

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/bookings — Créer une réservation
    // ─────────────────────────────────────────────────────────────────────────
    @PostMapping
    @Operation(
        summary = "Créer une réservation",
        description = """
            Crée une réservation et déclenche automatiquement le paiement selon le canal :
            - GUICHET : paiement espèces immédiat, billet d'embarquement généré sur place.
            - WEB : événement booking.created publié vers payment-service qui initie
                        le paiement mobile money (MTN / Orange) via paymentMethodType.
                        Une réservation WEB ne peut être payée qu'en ligne — aucun
                        passage en caisse n'est possible pour ce canal.
            """
    )
    public ResponseEntity<ReservationResponse> creerReservation(
            @Valid @RequestBody CreerReservationRequest request) {
        Reservation reservation = reservationService.creerReservation(
                request.getIdVoyage(),
                request.getIdVoyageur(),
                request.getNomVoyageur(),
                request.getPrenomVoyageur(),
                request.getTelephoneVoyageur(),
                request.getEmailVoyageur(),
                request.getNombrePlaces(),
                request.getCanal(),
                request.getCodeAgence(),
                request.getCodeFiliale(),
                request.getIdGuichetier(),
                request.getTypeTarif(),
                request.getMembresGroupe(),
                request.getSiegesDemandes(),
                request.getDevise(),
                request.getPaymentMethodType(),
                request.getTelephonePaiement(),
                request.getOperateurPaiement()
        );
        return ResponseEntity.ok(toResponse(reservation));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/bookings/voyage/{voyageId}/sieges
    // ─────────────────────────────────────────────────────────────────────────
    @GetMapping("/voyage/{voyageId}/sieges")
    @Operation(
        summary = "Plan des sièges d'un voyage",
        description = "Retourne la liste des sièges disponibles, occupés, et en attente de paiement."
    )
    public ResponseEntity<Map<String, Object>> getSieges(@PathVariable String voyageId) {
        return ResponseEntity.ok(reservationService.getSiegesVoyage(voyageId));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/bookings/voyage/{voyageId}/passagers
    // ─────────────────────────────────────────────────────────────────────────
    @GetMapping("/voyage/{voyageId}/passagers")
    @Operation(
        summary = "Manifeste complet des passagers d'un voyage",
        description = """
            Retourne la liste des passagers d'un voyage avec :
            - Numéro de siège occupé par chaque passager
            - Nombre total de places occupées et places libres
            - Liste des sièges occupés
            - Distinction claire entre passagers WEB (mobile money) et GUICHET (espèces)
            """
    )
    public ResponseEntity<VoyagePassagersResponse> getPassagersVoyage(
            @PathVariable String voyageId) {
        return ResponseEntity.ok(reservationService.getPassagersVoyage(voyageId));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/bookings/ticket/by-numero/{numeroTicket}
    // FIX : permet au guichetier de rechercher un billet par son numéro string
    // sans avoir besoin de l'ID Long de la réservation.
    // ─────────────────────────────────────────────────────────────────────────
    @GetMapping("/ticket/by-numero/{numeroTicket}")
    @Operation(
        summary = "Récupérer un ticket par son numéro unique",
        description = """
            Recherche un billet par son numéro unique (ex: SUNSET BAF-WEB-20260516-SUNDLA-000001).
            Utilisé par le guichetier lors de la vérification avant conversion en billet d'embarquement.
            Retourne les informations du billet : voyageur, trajet, statut, type (WEB ou EMB).
            """
    )
    public ResponseEntity<TicketResponse> getTicketByNumero(
            @PathVariable String numeroTicket) {
        Ticket ticket = ticketRepository.findByNumeroTicket(numeroTicket)
                .orElseThrow(() -> new RuntimeException(
                        "Billet introuvable : " + numeroTicket));
        String type = (ticket instanceof TicketElectronique) ? "WEB" : "EMB";
        return ResponseEntity.ok(toTicketResponse(ticket, type));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PATCH /api/bookings/ticket/convert-by-numero
    // FIX : convertit un billet électronique en billet d'embarquement
    // en passant directement le numéro de ticket (string), sans ID Long.
    // ─────────────────────────────────────────────────────────────────────────
    @PatchMapping("/ticket/convert-by-numero")
    @Operation(
        summary = "Convertir un billet électronique en billet d'embarquement par numéro",
        description = """
            Le guichetier saisit le numéro unique du billet électronique présenté par le voyageur.
            Ce endpoint convertit directement le billet sans avoir besoin de l'ID Long de la réservation.
            Le billet électronique est marqué CONVERTI et ne peut plus être réutilisé.
            Un billet d'embarquement est créé et retourné immédiatement.
            """
    )
    public ResponseEntity<TicketResponse> convertirParNumero(
            @Valid @RequestBody ConfirmerReservationRequest request) {
        TicketEmbarquement ticket = reservationService.convertirBilletElectronique(
                request.getNumeroTicketElectronique(), request.getIdGuichetier());
        return ResponseEntity.ok(toTicketResponse(ticket, "EMB"));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/bookings/{id}
    // ─────────────────────────────────────────────────────────────────────────
    @GetMapping("/{id}")
    @Operation(summary = "Détail d'une réservation")
    public ResponseEntity<ReservationResponse> getReservation(@PathVariable Long id) {
        return ResponseEntity.ok(toResponse(reservationService.getReservation(id)));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/bookings/voyage/{voyageId}
    // ─────────────────────────────────────────────────────────────────────────
    @GetMapping("/voyage/{voyageId}")
    @Operation(summary = "Réservations d'un voyage")
    public ResponseEntity<List<ReservationResponse>> getReservationsVoyage(
            @PathVariable String voyageId) {
        return ResponseEntity.ok(
                reservationService.getReservationsVoyage(voyageId)
                        .stream().map(this::toResponse).toList());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/bookings/history/{userId}
    // ─────────────────────────────────────────────────────────────────────────
    @GetMapping("/history/{userId}")
    @Operation(summary = "Historique d'un voyageur")
    public ResponseEntity<List<ReservationResponse>> getHistorique(
            @PathVariable String userId) {
        return ResponseEntity.ok(
                reservationService.getReservationsVoyageur(userId)
                        .stream().map(this::toResponse).toList());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/bookings/stats/{filialeId}
    // ─────────────────────────────────────────────────────────────────────────
    @GetMapping("/stats/{filialeId}")
    @Operation(summary = "Statistiques des réservations d'une filiale")
    public ResponseEntity<ReservationStatsResponse> getStats(
            @PathVariable String filialeId,
            @RequestParam String codeFiliale) {
        ReservationStatsResponse stats = reservationService.getStatsFiliale(codeFiliale);
        return ResponseEntity.ok(ReservationStatsResponse.builder()
                .filialeId(filialeId)
                .totalReservations(stats.getTotalReservations())
                .reservationsConfirmees(stats.getReservationsConfirmees())
                .reservationsAnnulees(stats.getReservationsAnnulees())
                .reservationsEnAttente(stats.getReservationsEnAttente())
                .reservationsEmbarquees(stats.getReservationsEmbarquees())
                .totalPlacesVendues(stats.getTotalPlacesVendues())
                .chiffreAffairesTotal(stats.getChiffreAffairesTotal())
                .tauxConversion(stats.getTauxConversion())
                .build());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/bookings/recettes/agence/{codeAgence}
    // ─────────────────────────────────────────────────────────────────────────
    @GetMapping("/recettes/agence/{codeAgence}")
    @Operation(
        summary = "Recettes d'une agence",
        description = """
            Retourne la ventilation des recettes de l'agence :
            - recetteTotale : somme de toutes les réservations payées (WEB + GUICHET)
            - recetteEnLigne : montant perçu via paiement mobile money (canal WEB)
            - recetteGuichet : montant perçu en espèces localement (canal GUICHET)
            - nbReservationsEnLigne / nbReservationsGuichet : compteurs par canal
            - partEnLignePct / partGuichetPct : répartition en pourcentage
            """
    )
    public ResponseEntity<RecettesResponse> getRecettesAgence(
            @PathVariable String codeAgence,
            @RequestParam(required = false, defaultValue = "XAF") String devise) {
        return ResponseEntity.ok(reservationService.getRecettesAgence(codeAgence, devise));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/bookings/recettes/filiale/{codeFiliale}
    // ─────────────────────────────────────────────────────────────────────────
    @GetMapping("/recettes/filiale/{codeFiliale}")
    @Operation(
        summary = "Recettes d'une filiale",
        description = """
            Retourne la ventilation des recettes de la filiale :
            - recetteTotale : somme de toutes les réservations payées (WEB + GUICHET)
            - recetteEnLigne : montant perçu via paiement mobile money (canal WEB)
            - recetteGuichet : montant perçu en espèces localement (canal GUICHET)
            - nbReservationsEnLigne / nbReservationsGuichet : compteurs par canal
            - partEnLignePct / partGuichetPct : répartition en pourcentage
            """
    )
    public ResponseEntity<RecettesResponse> getRecettesFiliale(
            @PathVariable String codeFiliale,
            @RequestParam(required = false, defaultValue = "XAF") String devise) {
        return ResponseEntity.ok(reservationService.getRecettesFiliale(codeFiliale, devise));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PATCH /api/bookings/{id}/cancel
    // ─────────────────────────────────────────────────────────────────────────
    @PatchMapping("/{id}/cancel")
    @Operation(
        summary = "Annuler une réservation",
        description = """
            Annule la réservation et libère les sièges.
            Si la réservation était déjà PAYEE ou CONFIRMEE, un événement
            booking.refund.requested est automatiquement publié vers payment-service
            pour déclencher le remboursement via l'opérateur mobile money.
            """
    )
    public ResponseEntity<ReservationResponse> annuler(
            @PathVariable Long id,
            @RequestParam String idUtilisateur) {
        return ResponseEntity.ok(
                toResponse(reservationService.annulerReservation(id, idUtilisateur)));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PATCH /api/bookings/{id}/convert-ticket
    // ─────────────────────────────────────────────────────────────────────────
    @PatchMapping("/{id}/convert-ticket")
    @Operation(
        summary = "Convertir billet électronique en billet d'embarquement (par ID réservation)",
        description = """
            Version alternative utilisant l'ID Long de la réservation.
            Préférer /ticket/convert-by-numero pour le flux guichetier standard.
            """
    )
    public ResponseEntity<TicketResponse> convertirBilletElectronique(
            @PathVariable Long id,
            @Valid @RequestBody ConfirmerReservationRequest request) {
        TicketEmbarquement ticket = reservationService.convertirBilletElectronique(
                request.getNumeroTicketElectronique(), request.getIdGuichetier());
        return ResponseEntity.ok(toTicketResponse(ticket, "EMB"));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/bookings/{id}/ticket
    // ─────────────────────────────────────────────────────────────────────────
    @GetMapping("/{id}/ticket")
    @Operation(summary = "Informations du billet lié à une réservation (par ID Long)")
    public ResponseEntity<TicketResponse> getTicket(@PathVariable Long id) {
        Reservation reservation = reservationService.getReservation(id);
        Ticket ticket = reservation.getTickets().stream()
                .filter(t -> t instanceof TicketElectronique)
                .findFirst()
                .orElse(reservation.getTickets().stream().findFirst()
                        .orElseThrow(() -> new RuntimeException(
                                "Aucun billet pour la réservation " + id)));
        String type = (ticket instanceof TicketElectronique) ? "WEB" : "EMB";
        return ResponseEntity.ok(toTicketResponse(ticket, type));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/bookings/{id}/ticket/pdf
    // ─────────────────────────────────────────────────────────────────────────
    @GetMapping("/{id}/ticket/pdf")
    @Operation(
        summary = "Télécharger le billet PDF",
        description = "Disponible uniquement pour les billets électroniques (canal WEB)."
    )
    public ResponseEntity<byte[]> telechargerBilletPdf(@PathVariable Long id) {
        Reservation reservation = reservationService.getReservation(id);
        TicketElectronique ticketElec = reservation.getTickets().stream()
                .filter(t -> t instanceof TicketElectronique)
                .map(t -> (TicketElectronique) t)
                .findFirst()
                .orElseThrow(() -> new RuntimeException(
                        "Aucun billet électronique pour la réservation " + id));
        try {
            byte[] pdf = pdfGeneratorService.lirePdf(ticketElec.getNumeroTicket());
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_PDF);
            headers.setContentDispositionFormData("attachment",
                    "billet-" + ticketElec.getNumeroTicket() + ".pdf");
            headers.setContentLength(pdf.length);
            return ResponseEntity.ok().headers(headers).body(pdf);
        } catch (Exception e) {
            throw new RuntimeException("Impossible de récupérer le PDF : " + e.getMessage());
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/bookings/depart/valider-billet
    // ─────────────────────────────────────────────────────────────────────────
    @PostMapping("/depart/valider-billet")
    @Operation(
        summary = "Valider un billet au départ",
        description = """
            Le manager local scanne le billet du passager au moment de l'embarquement.
            La réservation passe en statut EMBARQUEE.
            Un billet électronique non converti est refusé.
            """
    )
    public ResponseEntity<TicketResponse> validerBilletDepart(
            @Valid @RequestBody ValiderBilletDepartRequest request) {
        Ticket ticket = reservationService.validerBilletDepart(
                request.getNumeroBillet(), request.getIdManager());
        String type = (ticket instanceof TicketElectronique) ? "WEB" : "EMB";
        return ResponseEntity.ok(toTicketResponse(ticket, type));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/bookings/depart/cloturer
    // ─────────────────────────────────────────────────────────────────────────
    @PostMapping("/depart/cloturer")
    @Operation(
        summary = "Clôturer le départ d'un voyage",
        description = """
            Appelé par le manager local une fois tous les billets validés.
            Publie booking.depart vers fleet-service (marque le voyage PARTI)
            et vers notification-service (récapitulatif de départ).
            """
    )
    public ResponseEntity<Map<String, Object>> cloturerDepart(
            @RequestParam String idVoyage,
            @RequestParam String idManager) {
        return ResponseEntity.ok(reservationService.cloturerDepart(idVoyage, idManager));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/bookings/fidelite/{idVoyageur}
    // ─────────────────────────────────────────────────────────────────────────
    @GetMapping("/fidelite/{idVoyageur}")
    @Operation(
        summary = "Compteur de fidélité d'un voyageur",
        description = "Retourne le nombre de voyages effectués et indique si un voyage gratuit est disponible (tous les 10 voyages)."
    )
    public ResponseEntity<Map<String, Object>> getFidelite(
            @PathVariable String idVoyageur,
            @RequestParam String codeAgence) {
        int nombreVoyages     = fideliteService.getNombreVoyages(idVoyageur, codeAgence);
        boolean voyageGratuit = fideliteService.estVoyageGratuit(idVoyageur, codeAgence);
        int voyagesRestants   = voyageGratuit ? 0 : 10 - (nombreVoyages % 10);
        return ResponseEntity.ok(Map.of(
                "idVoyageur",      idVoyageur,
                "codeAgence",      codeAgence,
                "nombreVoyages",   nombreVoyages,
                "voyageGratuit",   voyageGratuit,
                "voyagesRestants", voyagesRestants,
                "message", voyageGratuit
                        ? "Votre prochain voyage est GRATUIT !"
                        : "Encore " + voyagesRestants + " voyage(s) pour un voyage gratuit."
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
                .devise(r.getDevise())
                .idVoyage(r.getIdVoyage())
                .idVoyageur(r.getIdVoyageur())
                .dateReservation(r.getDateReservation())
                .codeAgence(r.getCodeAgence())
                .codeFiliale(r.getCodeFiliale())
                .build();
    }

    private TicketResponse toTicketResponse(Ticket t, String type) {
        String cheminPdf = (t instanceof TicketElectronique te) ? te.getCheminPdf() : null;
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