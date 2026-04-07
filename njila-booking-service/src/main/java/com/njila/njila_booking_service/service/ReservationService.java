package com.njila.njila_booking_service.service;

import com.njila.njila_booking_service.client.FleetServiceClient;
import com.njila.njila_booking_service.client.UserServiceClient;
import com.njila.njila_booking_service.domain.entity.*;
import com.njila.njila_booking_service.domain.enums.*;
import com.njila.njila_booking_service.dto.request.CreerReservationRequest;
import com.njila.njila_booking_service.dto.response.ReservationStatsResponse;
import com.njila.njila_booking_service.messaging.publisher.BookingEventPublisher;
import com.njila.njila_booking_service.repository.*;
import com.njila.njila_booking_service.service.factory.TicketElectroniqueFactory;
import com.njila.njila_booking_service.service.factory.TicketEmbarquementFactory;
import com.njila.njila_booking_service.service.pricing.*;
import org.springframework.transaction.annotation.Transactional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class ReservationService {

    private final ReservationRepository           reservationRepository;
    private final TicketRepository                ticketRepository;
    private final PaiementRepository              paiementRepository;
    private final HistoriqueReservationRepository historiqueRepository;
    private final PlaceReserveeRepository         placeReserveeRepository;
    private final ReservationLockManager          lockManager;
    private final TicketNumberGenerator           ticketNumberGenerator;
    private final PdfGeneratorService             pdfGeneratorService;
    private final BookingEventPublisher           eventPublisher;
    private final FleetServiceClient              fleetClient;
    private final UserServiceClient               userClient;
    private final TicketElectroniqueFactory       ticketElectroniqueFactory;
    private final TicketEmbarquementFactory       ticketEmbarquementFactory;
    private final FideliteService                 fideliteService;
    private final PrixStandardStrategy            prixStandard;
    private final PrixGroupeStrategy              prixGroupe;
    private final PrixPromoStrategy               prixPromo;

    // ─────────────────────────────────────────────────────────────────────────
    // CRÉER UNE RÉSERVATION
    // ─────────────────────────────────────────────────────────────────────────

    @Transactional
    public Reservation creerReservation(
            Long idVoyage,
            Long idVoyageur,
            int nombrePlaces,
            CanalReservation canal,
            String codeAgence,
            String codeFiliale,
            Long idGuichetier,
            CreerReservationRequest.TypeTarif typeTarif,
            List<CreerReservationRequest.MembreGroupeRequest> membres,
            String devise) {

        if (!fleetClient.verifierDisponibilite(idVoyage, nombrePlaces)) {
            throw new RuntimeException(
                    "Places insuffisantes pour le voyage " + idVoyage);
        }

        Reservation saved = reservationRepository.save(
                Reservation.builder()
                        .idVoyage(idVoyage)
                        .idVoyageur(idVoyageur)
                        .nombrePlaces(nombrePlaces)
                        .canal(canal)
                        .codeAgence(codeAgence)
                        .codeFiliale(codeFiliale)
                        .idGuichetier(idGuichetier)
                        .statut(StatutReservation.EN_ATTENTE)
                        .montantTotal(0.0)
                        .devise(devise != null ? devise : "XAF")
                        .build()
        );

        if (!lockManager.acquerirVerrou(idVoyage, idVoyageur, saved.getId())) {
            reservationRepository.delete(saved);
            throw new RuntimeException(
                    "Une réservation est déjà en cours pour ce voyage.");
        }

        Map<String, Object> voyage   = fleetClient.getVoyage(idVoyage);
        double prixBase = Double.parseDouble(voyage.get("prix").toString());

        PricingStrategy strategie = switch (typeTarif) {
            case GROUPE -> prixGroupe;
            case PROMO  -> prixPromo;
            default     -> prixStandard;
        };
        double montantTotal = strategie.calculerPrix(saved, prixBase, nombrePlaces);
        saved.setMontantTotal(montantTotal);

        Map<String, Object> voyageur = userClient.getVoyageur(idVoyageur);
        PlaceReservee placeResponsable = PlaceReservee.builder()
                .reservation(saved)
                .idPlace(1L)
                .prixUnitaire(prixBase)
                .nomPassager(voyageur.get("nom") + " " + voyageur.get("surname"))
                .telephonePassager(voyageur.get("phone").toString())
                .aBagage(false)
                .estResponsable(true)
                .idVoyageur(idVoyageur)
                .build();
        saved.getPlacesReservees().add(placeResponsable);

        if (membres != null && !membres.isEmpty()) {
            for (CreerReservationRequest.MembreGroupeRequest membre : membres) {
                PlaceReservee place = PlaceReservee.builder()
                        .reservation(saved)
                        .idPlace(1L)
                        .prixUnitaire(prixBase)
                        .nomPassager(membre.getNom() + " " + membre.getPrenom())
                        .telephonePassager(membre.getTelephone())
                        .aBagage(membre.getABagage() != null && membre.getABagage())
                        .estResponsable(false)
                        .idVoyageur(null)
                        .build();
                saved.getPlacesReservees().add(place);
            }
        }

        reservationRepository.save(saved);

        historiqueRepository.save(HistoriqueReservation.creer(
                saved, TypeAction.CREATION, idVoyageur,
                "Canal=" + canal + " Tarif=" + typeTarif
                + " Places=" + nombrePlaces));

        log.info("[BOOKING] Réservation créée id={} canal={} tarif={} montant={}",
                saved.getId(), canal, typeTarif, montantTotal);

        if (canal == CanalReservation.GUICHET) {
            return confirmerReservationGuichet(
                    saved, voyage, voyageur, idGuichetier, codeAgence, codeFiliale);
        }

        eventPublisher.publierBookingCreated(
                saved.getId(), montantTotal, saved.getDevise(), idVoyageur, idVoyage);

        return saved;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CONFIRMER GUICHET — paiement espèces immédiat
    // ─────────────────────────────────────────────────────────────────────────

    @Transactional
    public Reservation confirmerReservationGuichet(
            Reservation reservation,
            Map<String, Object> voyage,
            Map<String, Object> voyageur,
            Long idGuichetier,
            String codeAgence,
            String codeFiliale) {

        reservation.setStatut(StatutReservation.PAYEE);
        reservationRepository.save(reservation);

        String numeroTicket = ticketNumberGenerator
                .genererBilletEmbarquement(codeAgence, codeFiliale);

        TicketEmbarquement ticket = (TicketEmbarquement)
                ticketEmbarquementFactory.creerTicket(
                        reservation,
                        numeroTicket,
                        voyageur.get("nom") + " " + voyageur.get("surname"),
                        voyageur.get("phone").toString(),
                        voyage.get("origine").toString(),
                        voyage.get("destination").toString(),
                        voyage.get("dateHeureDepart").toString().substring(0, 10),
                        voyage.get("immatriculationBus").toString()
                );
        ticket.setIdGuichetier(idGuichetier);
        ticketRepository.save(ticket);

        historiqueRepository.save(HistoriqueReservation.creer(
                reservation, TypeAction.CONFIRMATION, idGuichetier,
                "Paiement espèces guichet — billet=" + numeroTicket));

        fideliteService.incrementer(
                reservation.getIdVoyageur(), reservation.getCodeAgence());

        lockManager.libererVerrou(
                reservation.getIdVoyage(), reservation.getIdVoyageur());

        eventPublisher.publierTicketGenerated(
                reservation.getIdVoyageur(),
                voyageur.get("email").toString(),
                "",
                numeroTicket,
                voyage.get("origine").toString(),
                voyage.get("destination").toString(),
                voyage.get("dateHeureDepart").toString().substring(0, 10)
        );

        log.info("[BOOKING] Billet embarquement guichet généré : {}", numeroTicket);
        return reservation;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CORRECTION S6 — PATCH /api/bookings/{id}/confirm
    // Confirmer une réservation EN_ATTENTE suite à un paiement espèces
    // effectué ultérieurement (ex. réservation web payée au guichet).
    //
    // Ce cas est DISTINCT de la création directe au guichet :
    // la réservation existe déjà, le guichetier vient encaisser les espèces
    // et génère le billet d'embarquement immédiatement.
    // ─────────────────────────────────────────────────────────────────────────

    @Transactional
    public TicketEmbarquement confirmerPaiementEspeces(
            Long bookingId, Long idGuichetier, Double montantEncaisse) {

        Reservation reservation = reservationRepository.findById(bookingId)
                .orElseThrow(() -> new RuntimeException(
                        "Réservation introuvable : " + bookingId));

        if (reservation.getStatut() != StatutReservation.EN_ATTENTE) {
            throw new RuntimeException(
                    "Impossible de confirmer la réservation " + bookingId
                    + " : statut actuel = " + reservation.getStatut()
                    + " (attendu : EN_ATTENTE)");
        }

        // Passer en PAYEE
        reservation.setStatut(StatutReservation.PAYEE);
        reservationRepository.save(reservation);

        // Récupérer infos voyage + voyageur
        Map<String, Object> voyage   = fleetClient.getVoyage(reservation.getIdVoyage());
        Map<String, Object> voyageur = userClient.getVoyageur(reservation.getIdVoyageur());

        // Générer billet d'embarquement
        String numeroTicket = ticketNumberGenerator.genererBilletEmbarquement(
                reservation.getCodeAgence(), reservation.getCodeFiliale());

        TicketEmbarquement ticket = (TicketEmbarquement)
                ticketEmbarquementFactory.creerTicket(
                        reservation,
                        numeroTicket,
                        voyageur.get("nom") + " " + voyageur.get("surname"),
                        voyageur.get("phone").toString(),
                        voyage.get("origine").toString(),
                        voyage.get("destination").toString(),
                        voyage.get("dateHeureDepart").toString().substring(0, 10),
                        voyage.get("immatriculationBus").toString()
                );
        ticket.setIdGuichetier(idGuichetier);
        ticketRepository.save(ticket);

        // Tracer
        historiqueRepository.save(HistoriqueReservation.creer(
                reservation, TypeAction.CONFIRMATION, idGuichetier,
                "Paiement espèces au guichet — montant=" + montantEncaisse
                + " FCFA — billet=" + numeroTicket));

        // Incrémenter fidélité
        fideliteService.incrementer(
                reservation.getIdVoyageur(), reservation.getCodeAgence());

        // Libérer verrou Redis (peut déjà être expiré, pas bloquant)
        lockManager.libererVerrou(
                reservation.getIdVoyage(), reservation.getIdVoyageur());

        // Notifier notification-service
        eventPublisher.publierTicketGenerated(
                reservation.getIdVoyageur(),
                voyageur.get("email").toString(),
                "",
                numeroTicket,
                voyage.get("origine").toString(),
                voyage.get("destination").toString(),
                voyage.get("dateHeureDepart").toString().substring(0, 10)
        );

        log.info("[BOOKING] Paiement espèces confirmé — réservation={} billet={}",
                bookingId, numeroTicket);
        return ticket;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CONFIRMER APRÈS PAIEMENT EN LIGNE (appelé par PaymentEventConsumer)
    // ─────────────────────────────────────────────────────────────────────────

    @Transactional
    public void confirmerApresPaiement(Long bookingId, String transactionId) {

        Reservation reservation = reservationRepository.findById(bookingId)
                .orElseThrow(() -> new RuntimeException(
                        "Réservation introuvable : " + bookingId));

        reservation.setStatut(StatutReservation.PAYEE);
        reservationRepository.save(reservation);

        paiementRepository.findByReservationId(bookingId).ifPresent(p -> {
            p.setStatut(StatutPaiement.REUSSI);
            p.setReferenceTransaction(transactionId);
            paiementRepository.save(p);
        });

        Map<String, Object> voyage   = fleetClient.getVoyage(reservation.getIdVoyage());
        Map<String, Object> voyageur = userClient.getVoyageur(reservation.getIdVoyageur());

        String numeroTicket = ticketNumberGenerator
                .genererBilletElectronique(
                        reservation.getCodeAgence(),
                        reservation.getCodeFiliale());

        TicketElectronique ticket = (TicketElectronique)
                ticketElectroniqueFactory.creerTicket(
                        reservation,
                        numeroTicket,
                        voyageur.get("nom") + " " + voyageur.get("surname"),
                        voyageur.get("phone").toString(),
                        voyage.get("origine").toString(),
                        voyage.get("destination").toString(),
                        voyage.get("dateHeureDepart").toString().substring(0, 10),
                        voyage.get("immatriculationBus").toString()
                );

        byte[] pdf = pdfGeneratorService.genererBilletElectronique(ticket);
        ticket.setCheminPdf("");
        ticketRepository.save(ticket);

        historiqueRepository.save(HistoriqueReservation.creer(
                reservation, TypeAction.PAIEMENT,
                reservation.getIdVoyageur(),
                "Transaction=" + transactionId
                + " Billet=" + numeroTicket));

        fideliteService.incrementer(
                reservation.getIdVoyageur(), reservation.getCodeAgence());

        lockManager.libererVerrou(
                reservation.getIdVoyage(), reservation.getIdVoyageur());

        String pdfBase64 = java.util.Base64.getEncoder().encodeToString(pdf);

        eventPublisher.publierTicketGenerated(
                reservation.getIdVoyageur(),
                voyageur.get("email").toString(),
                pdfBase64,
                numeroTicket,
                voyage.get("origine").toString(),
                voyage.get("destination").toString(),
                voyage.get("dateHeureDepart").toString().substring(0, 10)
        );

        log.info("[BOOKING] Paiement confirmé — billet électronique généré : {}",
                numeroTicket);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ANNULER APRÈS ÉCHEC PAIEMENT
    // ─────────────────────────────────────────────────────────────────────────

    @Transactional
    public void annulerApresEchecPaiement(Long bookingId) {

        Reservation reservation = reservationRepository.findById(bookingId)
                .orElseThrow(() -> new RuntimeException(
                        "Réservation introuvable : " + bookingId));

        reservation.setStatut(StatutReservation.ANNULEE);
        reservationRepository.save(reservation);

        lockManager.libererVerrou(
                reservation.getIdVoyage(), reservation.getIdVoyageur());

        paiementRepository.findByReservationId(bookingId).ifPresent(p -> {
            p.setStatut(StatutPaiement.ECHOUE);
            paiementRepository.save(p);
        });

        historiqueRepository.save(HistoriqueReservation.creer(
                reservation, TypeAction.ANNULATION,
                reservation.getIdVoyageur(),
                "Paiement échoué — verrou libéré"));

        log.warn("[BOOKING] Réservation annulée après échec paiement id={}",
                bookingId);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CORRECTION UC-B4 — ANNULER PAR L'UTILISATEUR OU LE MANAGER
    // Postcondition : "Remboursement initié" via RabbitMQ
    // ─────────────────────────────────────────────────────────────────────────

    @Transactional
    public Reservation annulerReservation(Long bookingId, Long idUtilisateur) {

        Reservation reservation = reservationRepository.findById(bookingId)
                .orElseThrow(() -> new RuntimeException(
                        "Réservation introuvable : " + bookingId));

        if (reservation.getStatut() == StatutReservation.EMBARQUEE) {
            throw new RuntimeException(
                    "Impossible d'annuler une réservation déjà embarquée.");
        }
        if (reservation.getStatut() == StatutReservation.ANNULEE) {
            throw new RuntimeException("Cette réservation est déjà annulée.");
        }

        boolean etaitPayee = reservation.getStatut() == StatutReservation.PAYEE
                || reservation.getStatut() == StatutReservation.CONFIRMEE;

        reservation.setStatut(StatutReservation.ANNULEE);
        reservationRepository.save(reservation);

        // Mettre à jour le paiement si existant
        paiementRepository.findByReservationId(bookingId).ifPresent(p -> {
            p.setStatut(StatutPaiement.REMBOURSE);
            paiementRepository.save(p);
        });

        // Libérer le verrou si encore actif
        lockManager.libererVerrou(
                reservation.getIdVoyage(), reservation.getIdVoyageur());

        historiqueRepository.save(HistoriqueReservation.creer(
                reservation, TypeAction.ANNULATION,
                idUtilisateur, "Annulation par l'utilisateur"));

        // CORRECTION : initier le remboursement si la réservation était payée
        if (etaitPayee) {
            eventPublisher.publierRemboursementDemande(
                    bookingId,
                    reservation.getIdVoyageur(),
                    reservation.getMontantTotal(),
                    reservation.getDevise(),
                    "Annulation par l'utilisateur id=" + idUtilisateur
            );
            log.info("[BOOKING] Remboursement initié pour réservation annulée id={}",
                    bookingId);
        }

        log.info("[BOOKING] Réservation annulée id={} par utilisateur={}",
                bookingId, idUtilisateur);
        return reservation;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CONVERTIR BILLET ÉLECTRONIQUE → BILLET D'EMBARQUEMENT
    // ─────────────────────────────────────────────────────────────────────────

    @Transactional
    public TicketEmbarquement convertirBilletElectronique(
            String numeroTicketElec, Long idGuichetier) {

        Ticket ticketBase = ticketRepository.findByNumeroTicket(numeroTicketElec)
                .orElseThrow(() -> new RuntimeException(
                        "Billet introuvable : " + numeroTicketElec));

        if (!(ticketBase instanceof TicketElectronique ticketElec)) {
            throw new RuntimeException(
                    "Ce numéro ne correspond pas à un billet électronique.");
        }

        if (!ticketElec.validerTicket()) {
            throw new RuntimeException(
                    "Billet invalide ou déjà converti : " + numeroTicketElec);
        }

        ticketElec.setConverti(true);
        ticketElec.setStatut(StatutTicket.VERIFIE);
        ticketRepository.save(ticketElec);

        Reservation reservation = ticketElec.getReservation();
        String numeroEmb = ticketNumberGenerator.genererBilletEmbarquement(
                reservation.getCodeAgence(), reservation.getCodeFiliale());

        TicketEmbarquement ticketEmb = (TicketEmbarquement)
                ticketEmbarquementFactory.creerTicket(
                        reservation,
                        numeroEmb,
                        ticketElec.getNomVoyageur(),
                        ticketElec.getTelephoneVoyageur(),
                        ticketElec.getOrigine(),
                        ticketElec.getDestination(),
                        ticketElec.getDateDepart().toString(),
                        ticketElec.getImmatriculationBus()
                );
        ticketEmb.setIdTicketElectronique(ticketElec.getId());
        ticketEmb.setIdGuichetier(idGuichetier);
        ticketRepository.save(ticketEmb);

        ticketElec.setIdTicketEmbarquement(ticketEmb.getId());
        ticketRepository.save(ticketElec);

        reservation.setStatut(StatutReservation.CONFIRMEE);
        reservationRepository.save(reservation);

        historiqueRepository.save(HistoriqueReservation.creer(
                reservation, TypeAction.VERIFICATION_TICKET, idGuichetier,
                "Conversion billet électronique "
                + numeroTicketElec + " → embarquement " + numeroEmb));

        log.info("[BOOKING] Billet électronique converti : {} → {}",
                numeroTicketElec, numeroEmb);
        return ticketEmb;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // NOUVEAU UC-B7 — VALIDER UN BILLET AU DÉPART
    //
    // Le manager local scanne chaque billet avant l'embarquement.
    // Le billet passe en EMBARQUEE. Une fois tous les passagers validés,
    // appeler cloturerDepart() pour verrouiller le voyage.
    // ─────────────────────────────────────────────────────────────────────────

    @Transactional
    public Ticket validerBilletDepart(String numeroBillet, Long idManager) {

        Ticket ticket = ticketRepository.findByNumeroTicket(numeroBillet)
                .orElseThrow(() -> new RuntimeException(
                        "Billet introuvable : " + numeroBillet));

        if (ticket.getStatut() == StatutTicket.EMBARQUEE) {
            throw new RuntimeException(
                    "Ce billet est déjà validé : " + numeroBillet);
        }
        if (ticket.getStatut() == StatutTicket.ANNULE) {
            throw new RuntimeException(
                    "Ce billet est annulé, embarquement refusé : " + numeroBillet);
        }
        if (ticket instanceof TicketElectronique te && !te.getConverti()) {
            throw new RuntimeException(
                    "Ce billet électronique doit d'abord être converti en billet "
                    + "d'embarquement au guichet avant de valider le départ.");
        }

        // Marquer le billet comme utilisé
        ticket.marquerUtilise();
        ticketRepository.save(ticket);

        // Passer la réservation en EMBARQUEE
        Reservation reservation = ticket.getReservation();
        reservation.setStatut(StatutReservation.EMBARQUEE);
        reservationRepository.save(reservation);

        historiqueRepository.save(HistoriqueReservation.creer(
                reservation, TypeAction.EMBARQUEMENT, idManager,
                "Validation billet=" + numeroBillet + " au départ"));

        log.info("[DEPART] Billet validé : {} — réservation={} — manager={}",
                numeroBillet, reservation.getId(), idManager);
        return ticket;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // NOUVEAU UC-B7 — CLÔTURER LE DÉPART D'UN VOYAGE
    //
    // Après validation de tous les billets, le manager clôture le départ :
    // - Compte les passagers embarqués
    // - Publie booking.depart vers fleet-service et notification-service
    // ─────────────────────────────────────────────────────────────────────────

    @Transactional
    public Map<String, Object> cloturerDepart(Long idVoyage, Long idManager) {

        List<Reservation> reservations = reservationRepository.findByIdVoyage(idVoyage);

        if (reservations.isEmpty()) {
            throw new RuntimeException(
                    "Aucune réservation trouvée pour le voyage " + idVoyage);
        }

        long passagersEmbarques = reservations.stream()
                .filter(r -> r.getStatut() == StatutReservation.EMBARQUEE)
                .count();

        long totalConfirmees = reservations.stream()
                .filter(r -> r.getStatut() == StatutReservation.EMBARQUEE
                        || r.getStatut() == StatutReservation.CONFIRMEE
                        || r.getStatut() == StatutReservation.PAYEE)
                .count();

        int totalPlaces = reservations.stream()
                .mapToInt(Reservation::getNombrePlaces)
                .sum();

        // Publier l'événement de départ
        eventPublisher.publierDepartVoyage(
                idVoyage, idManager,
                (int) passagersEmbarques,
                totalPlaces
        );

        log.info("[DEPART] Voyage={} clôturé par manager={} — {}/{} passagers embarqués",
                idVoyage, idManager, passagersEmbarques, totalConfirmees);

        return Map.of(
                "voyageId",           idVoyage,
                "passagersEmbarques", passagersEmbarques,
                "totalConfirmees",    totalConfirmees,
                "totalPlaces",        totalPlaces,
                "statut",             "DEPART_CLOTURE"
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CORRECTION S6 — STATS PAR FILIALE
    //
    // GET /api/bookings/stats/{filialeId}
    // L'ancienne implémentation appelait getReservationsVoyage(filialeId),
    // ce qui est incorrect. On calcule ici de vraies métriques agrégées.
    // ─────────────────────────────────────────────────────────────────────────

    public ReservationStatsResponse getStatsFiliale(String codeFiliale) {

        List<ReservationRepository.StatutCount> counts =
                reservationRepository.countByStatutForFiliale(codeFiliale);

        long totalReservations    = 0;
        long confirmees           = 0;
        long annulees             = 0;
        long enAttente            = 0;
        long embarquees           = 0;

        for (ReservationRepository.StatutCount sc : counts) {
            totalReservations += sc.getTotal();
            switch (sc.getStatut()) {
                case CONFIRMEE, PAYEE -> confirmees  += sc.getTotal();
                case ANNULEE, EXPIREE -> annulees    += sc.getTotal();
                case EN_ATTENTE       -> enAttente   += sc.getTotal();
                case EMBARQUEE        -> {
                    embarquees   += sc.getTotal();
                    confirmees   += sc.getTotal(); // embarqués = aussi confirmés
                }
            }
        }

        double chiffreAffaires = reservationRepository
                .sumMontantByCodeFiliale(codeFiliale);

        long placesVendues = reservationRepository
                .sumPlacesVenduesByCodeFiliale(codeFiliale);

        double tauxConversion = totalReservations > 0
                ? Math.round((confirmees * 100.0 / totalReservations) * 10.0) / 10.0
                : 0.0;

        return ReservationStatsResponse.builder()
                .filialeId(null)  // résolu par le controller via codeFiliale
                .totalReservations(totalReservations)
                .reservationsConfirmees(confirmees)
                .reservationsAnnulees(annulees)
                .reservationsEnAttente(enAttente)
                .reservationsEmbarquees(embarquees)
                .totalPlacesVendues(placesVendues)
                .chiffreAffairesTotal(chiffreAffaires)
                .tauxConversion(tauxConversion)
                .build();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GETTERS
    // ─────────────────────────────────────────────────────────────────────────

    public Reservation getReservation(Long id) {
        return reservationRepository.findById(id)
                .orElseThrow(() -> new RuntimeException(
                        "Réservation introuvable : " + id));
    }

    public List<Reservation> getReservationsVoyage(Long idVoyage) {
        return reservationRepository.findByIdVoyage(idVoyage);
    }

    public List<Reservation> getReservationsVoyageur(Long idVoyageur) {
        return reservationRepository.findByIdVoyageur(idVoyageur);
    }
}