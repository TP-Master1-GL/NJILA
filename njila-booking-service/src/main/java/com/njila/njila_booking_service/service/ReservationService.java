package com.njila.njila_booking_service.service;

import com.njila.njila_booking_service.domain.entity.*;
import com.njila.njila_booking_service.domain.entity.projection.*;
import com.njila.njila_booking_service.domain.enums.*;
import com.njila.njila_booking_service.dto.request.CreerReservationRequest;
import com.njila.njila_booking_service.dto.response.RecettesResponse;
import com.njila.njila_booking_service.dto.response.ReservationStatsResponse;
import com.njila.njila_booking_service.dto.response.VoyagePassagersResponse;
import com.njila.njila_booking_service.repository.projection.*;
import com.njila.njila_booking_service.messaging.publisher.BookingEventPublisher;
import com.njila.njila_booking_service.repository.*;
import com.njila.njila_booking_service.service.factory.TicketElectroniqueFactory;
import com.njila.njila_booking_service.service.factory.TicketEmbarquementFactory;
import com.njila.njila_booking_service.service.pricing.*;
import org.springframework.transaction.annotation.Transactional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

@Service
@RequiredArgsConstructor
@Slf4j
public class ReservationService {

    private final ReservationRepository           reservationRepository;
    private final TicketRepository                ticketRepository;
    private final PaiementRepository              paiementRepository;
    private final HistoriqueReservationRepository historiqueRepository;
    private final PlaceReserveeRepository         placeReserveeRepository;

    private final SeatLockManager                 seatLockManager;
    private final TicketNumberGenerator           ticketNumberGenerator;
    private final PdfGeneratorService             pdfGeneratorService;
    private final BookingEventPublisher           eventPublisher;

    private final VoyageDataRepository            voyageDataRepository;
    private final UserDataRepository              userDataRepository;
    private final AgenceDataRepository            agenceDataRepository;
    private final FilialeDataRepository           filialeDataRepository;
    private final BusDataRepository               busDataRepository;

    private final TicketElectroniqueFactory       ticketElectroniqueFactory;
    private final TicketEmbarquementFactory       ticketEmbarquementFactory;
    private final FideliteService                 fideliteService;
    private final PrixStandardStrategy            prixStandard;
    private final PrixGroupeStrategy              prixGroupe;
    private final PrixPromoStrategy               prixPromo;

    // Statuts considérés comme "payés / actifs"
    private static final StatutReservation S_PAYEE     = StatutReservation.PAYEE;
    private static final StatutReservation S_CONFIRMEE = StatutReservation.CONFIRMEE;
    private static final StatutReservation S_EMBARQUEE = StatutReservation.EMBARQUEE;
    private static final StatutReservation S_ANNULEE   = StatutReservation.ANNULEE;
    private static final StatutReservation S_EXPIREE   = StatutReservation.EXPIREE;
    private static final StatutReservation S_EN_ATTENTE = StatutReservation.EN_ATTENTE;

    // Durée maximale d'attente d'un paiement WEB avant expiration automatique
    // Doit être cohérente avec le TTL Redis du SeatLockManager
    static final int PAIEMENT_TIMEOUT_MINUTES = 15;

    // ─────────────────────────────────────────────────────────────────────────
    // CRÉER UNE RÉSERVATION
    // ─────────────────────────────────────────────────────────────────────────

    @Transactional
    public Reservation creerReservation(
            String idVoyage,
            String idVoyageur,
            String nomVoyageur,
            String prenomVoyageur,
            String telephoneVoyageur,
            String emailVoyageur,
            int nombrePlaces,
            CanalReservation canal,
            String codeAgence,
            String codeFiliale,
            String idGuichetier,
            CreerReservationRequest.TypeTarif typeTarif,
            List<CreerReservationRequest.MembreGroupeRequest> membresGroupe,
            List<Integer> siegesDemandes,
            String devise,
            String paymentMethodType,
            String telephonePaiement,
            String operateurPaiement) {

        // ── 1. Résoudre le voyage ─────────────────────────────────────────────
        VoyageData voyageData = voyageDataRepository.findById(idVoyage)
                .orElseThrow(() -> new RuntimeException(
                        "Voyage introuvable : " + idVoyage));

        if (voyageData.getPlacesDisponibles() < nombrePlaces) {
            throw new RuntimeException(
                    "Places insuffisantes pour le voyage " + idVoyage
                    + " (" + voyageData.getPlacesDisponibles() + " disponible(s))");
        }

        // ── 2. Capacité du bus ────────────────────────────────────────────────
        int capaciteBus = resolverCapaciteBus(voyageData);

        // ── 3. Attribuer les sièges ───────────────────────────────────────────
        List<Integer> siegesAttribues = attribuerSieges(
                idVoyage, capaciteBus, nombrePlaces, siegesDemandes);

        // ── 4. Résoudre le voyageur ───────────────────────────────────────────
        UserData voyageur = resolverVoyageur(
                idVoyageur, nomVoyageur, prenomVoyageur,
                telephoneVoyageur, emailVoyageur);

        // ── 5. Acquérir les verrous Redis (TTL = PAIEMENT_TIMEOUT_MINUTES) ────
        if (!seatLockManager.acquerirVerrouSieges(idVoyage, idVoyageur, siegesAttribues)) {
            throw new RuntimeException(
                    "Les sièges demandés viennent d'être réservés par un autre client. "
                    + "Veuillez sélectionner d'autres places.");
        }

        // ── 6. Persister la réservation EN_ATTENTE ────────────────────────────
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
                        .dateReservation(LocalDateTime.now())
                        .build()
        );

        try {
            // ── 7. Calculer le montant ────────────────────────────────────────
            double prixBase = voyageData.getPrix();
            PricingStrategy strategie = switch (typeTarif) {
                case GROUPE -> prixGroupe;
                case PROMO  -> prixPromo;
                default     -> prixStandard;
            };
            double montantTotal = strategie.calculerPrix(saved, prixBase, nombrePlaces);
            saved.setMontantTotal(montantTotal);

            // ── 8. Créer les PlaceReservee ────────────────────────────────────
            int indexSiege = 0;

            PlaceReservee placeResponsable = PlaceReservee.builder()
                    .reservation(saved)
                    .numeroSiege(siegesAttribues.get(indexSiege++))
                    .idPlace(null)
                    .prixUnitaire(prixBase)
                    .nomPassager(voyageur.getNom() + " " + voyageur.getPrenom())
                    .telephonePassager(voyageur.getTelephone())
                    .aBagage(false)
                    .estResponsable(true)
                    .idVoyageur(idVoyageur)
                    .build();
            saved.getPlacesReservees().add(placeResponsable);

            if (membresGroupe != null) {
                for (CreerReservationRequest.MembreGroupeRequest membre : membresGroupe) {
                    PlaceReservee place = PlaceReservee.builder()
                            .reservation(saved)
                            .numeroSiege(siegesAttribues.get(indexSiege++))
                            .idPlace(null)
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

            // ── 9. Historique ─────────────────────────────────────────────────
            historiqueRepository.save(HistoriqueReservation.creer(
                    saved, TypeAction.CREATION, idVoyageur,
                    "Canal=" + canal + " Tarif=" + typeTarif
                    + " Places=" + nombrePlaces
                    + " Sièges=" + siegesAttribues
                    + " — en attente paiement (TTL=" + PAIEMENT_TIMEOUT_MINUTES + "min)"));

            log.info("[BOOKING] Réservation créée id={} canal={} tarif={} montant={} sièges={}",
                    saved.getId(), canal, typeTarif, montantTotal, siegesAttribues);

            // ── 10. Routing guichet vs web ────────────────────────────────────
            if (canal == CanalReservation.GUICHET) {
                return confirmerReservationGuichet(
                        saved, voyageData, voyageur,
                        idGuichetier, codeAgence, codeFiliale,
                        siegesAttribues);
            }

            // ── 11. Canal WEB : déléguer le paiement au payment-service ───────
            String phoneNumberPaiement = (telephonePaiement != null && !telephonePaiement.isBlank())
                    ? telephonePaiement
                    : voyageur.getTelephone();

            eventPublisher.publierBookingCreated(
                    saved.getId(),
                    montantTotal,
                    saved.getDevise(),
                    idVoyageur,
                    idVoyage,
                    phoneNumberPaiement,
                    paymentMethodType != null ? paymentMethodType : "MOBILE_MONEY",
                    operateurPaiement != null ? operateurPaiement : "ORANGE_MONEY"
            );

            log.info("[BOOKING] Événement booking.created publié — réservation={} "
                    + "en attente réponse payment-service (max {}min)",
                    saved.getId(), PAIEMENT_TIMEOUT_MINUTES);

            return saved;

        } catch (Exception e) {
            log.error("[BOOKING] Erreur à la création id={} — libération immédiate des verrous",
                    saved.getId(), e);
            seatLockManager.libererSieges(idVoyage, siegesAttribues);
            try {
                reservationRepository.delete(saved);
            } catch (Exception suppressed) {
                log.error("[BOOKING] Impossible de supprimer la réservation id={} après erreur",
                        saved.getId(), suppressed);
            }
            throw e;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CONFIRMER APRÈS PAIEMENT EN LIGNE (appelé par PaymentEventConsumer)
    // ─────────────────────────────────────────────────────────────────────────

    @Transactional
    public void confirmerApresPaiement(Long bookingId, String transactionId) {

        Reservation reservation = reservationRepository.findById(bookingId)
                .orElseThrow(() -> new RuntimeException(
                        "Réservation introuvable : " + bookingId));

        if (reservation.getStatut() == StatutReservation.PAYEE) {
            log.warn("[BOOKING] confirmerApresPaiement : réservation {} déjà PAYEE — ignoré", bookingId);
            return;
        }

        if (reservation.getStatut() != StatutReservation.EN_ATTENTE) {
            throw new RuntimeException(
                    "Impossible de confirmer la réservation " + bookingId
                    + " : statut=" + reservation.getStatut()
                    + " (attendu: EN_ATTENTE)");
        }

        if (reservation.getCanal() != CanalReservation.WEB) {
            throw new RuntimeException(
                    "Impossible de confirmer via paiement en ligne la réservation " + bookingId
                    + " : canal=" + reservation.getCanal()
                    + " (attendu: WEB)");
        }

        reservation.setStatut(StatutReservation.PAYEE);
        reservationRepository.save(reservation);

        paiementRepository.findByReservationId(bookingId).ifPresent(p -> {
            p.setStatut(StatutPaiement.REUSSI);
            p.setReferenceTransaction(transactionId);
            paiementRepository.save(p);
        });

        VoyageData voyage = voyageDataRepository.findById(reservation.getIdVoyage())
                .orElseThrow(() -> new RuntimeException("Voyage introuvable"));

        UserData voyageur = resolverVoyageur(
                reservation.getIdVoyageur(), null, null, null, null);

        String numeroTicket = ticketNumberGenerator.genererBilletElectronique(
                reservation.getCodeAgence(), reservation.getCodeFiliale());

        TicketElectronique ticket = (TicketElectronique)
                ticketElectroniqueFactory.creerTicket(
                        reservation,
                        numeroTicket,
                        voyageur.getNom() + " " + voyageur.getPrenom(),
                        voyageur.getTelephone(),
                        voyage.getOrigine(),
                        voyage.getDestination(),
                        voyage.getDateHeureDepart().toString().substring(0, 10),
                        voyage.getImmatriculationBus(),
                        agenceDataRepository.findById(reservation.getCodeAgence())
                                .map(AgenceData::getLogoUrl).orElse(null)
                );

        byte[] pdf = pdfGeneratorService.genererBilletElectronique(ticket);
        ticket.setCheminPdf("");
        ticketRepository.save(ticket);

        historiqueRepository.save(HistoriqueReservation.creer(
                reservation, TypeAction.PAIEMENT,
                reservation.getIdVoyageur(),
                "Transaction=" + transactionId + " Billet=" + numeroTicket));

        fideliteService.incrementer(reservation.getIdVoyageur(), reservation.getCodeAgence());

        List<Integer> sieges = reservation.getPlacesReservees().stream()
                .map(PlaceReservee::getNumeroSiege)
                .collect(Collectors.toList());
        seatLockManager.libererSieges(reservation.getIdVoyage(), sieges);

        String pdfBase64 = java.util.Base64.getEncoder().encodeToString(pdf);

        eventPublisher.publierTicketGenerated(
                reservation.getIdVoyageur(),
                voyageur.getEmail(),
                pdfBase64,
                numeroTicket,
                voyage.getOrigine(),
                voyage.getDestination(),
                voyage.getDateHeureDepart().toString().substring(0, 10)
        );

        log.info("[BOOKING] Paiement en ligne confirmé — billet électronique généré : {}", numeroTicket);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SUPPRIMER APRÈS ÉCHEC PAIEMENT (appelé par PaymentEventConsumer)
    // ─────────────────────────────────────────────────────────────────────────

    @Transactional
    public void supprimerApresEchecPaiement(Long bookingId, String motif) {

        Reservation reservation = reservationRepository.findById(bookingId)
                .orElseThrow(() -> new RuntimeException(
                        "Réservation introuvable : " + bookingId));

        if (reservation.getStatut() == StatutReservation.ANNULEE
                || reservation.getStatut() == StatutReservation.EXPIREE) {
            log.warn("[BOOKING] supprimerApresEchecPaiement : réservation {} déjà en état terminal — ignoré", bookingId);
            return;
        }

        if (reservation.getStatut() != StatutReservation.EN_ATTENTE) {
            log.error("[BOOKING] supprimerApresEchecPaiement : réservation {} en statut {} "
                    + "— abandon suppression pour éviter perte de données",
                    bookingId, reservation.getStatut());
            return;
        }

        List<Integer> sieges = reservation.getPlacesReservees().stream()
                .map(PlaceReservee::getNumeroSiege)
                .collect(Collectors.toList());

        paiementRepository.findByReservationId(bookingId).ifPresent(p -> {
            p.setStatut(StatutPaiement.ECHOUE);
            paiementRepository.save(p);
        });

        placeReserveeRepository.deleteByReservationId(bookingId);
        historiqueRepository.deleteByReservationId(bookingId);
        reservationRepository.delete(reservation);

        seatLockManager.libererSieges(reservation.getIdVoyage(), sieges);

        log.warn("[BOOKING] Réservation {} supprimée après échec paiement — motif={} sièges={}",
                bookingId, motif, sieges);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // EXPIRER LES RÉSERVATIONS EN ATTENTE
    // ─────────────────────────────────────────────────────────────────────────

    @Transactional
    public void expirerReservationsEnAttente() {

        LocalDateTime limite = LocalDateTime.now().minusMinutes(PAIEMENT_TIMEOUT_MINUTES);

        List<Reservation> expirees = reservationRepository
                .findByStatutAndCanalAndDateReservationBefore(
                        StatutReservation.EN_ATTENTE,
                        CanalReservation.WEB,
                        limite
                );

        if (expirees.isEmpty()) return;

        log.info("[SCHEDULER] {} réservation(s) WEB expirée(s) à traiter", expirees.size());

        for (Reservation r : expirees) {
            try {
                List<Integer> sieges = r.getPlacesReservees().stream()
                        .map(PlaceReservee::getNumeroSiege)
                        .collect(Collectors.toList());

                placeReserveeRepository.deleteByReservationId(r.getId());
                historiqueRepository.deleteByReservationId(r.getId());
                reservationRepository.delete(r);

                seatLockManager.libererSieges(r.getIdVoyage(), sieges);

                log.warn("[SCHEDULER] Réservation {} expirée et supprimée — voyage={} sièges={}",
                        r.getId(), r.getIdVoyage(), sieges);

            } catch (Exception e) {
                log.error("[SCHEDULER] Erreur lors de l'expiration de la réservation {} : {}",
                        r.getId(), e.getMessage(), e);
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CONFIRMER GUICHET
    // ─────────────────────────────────────────────────────────────────────────

    @Transactional
    public Reservation confirmerReservationGuichet(
            Reservation reservation,
            VoyageData voyage,
            UserData voyageur,
            String idGuichetier,
            String codeAgence,
            String codeFiliale,
            List<Integer> siegesAttribues) {

        reservation.setStatut(StatutReservation.PAYEE);
        reservationRepository.save(reservation);

        String numeroTicket = ticketNumberGenerator.genererBilletEmbarquement(codeAgence, codeFiliale);

        TicketEmbarquement ticket = (TicketEmbarquement)
                ticketEmbarquementFactory.creerTicket(
                        reservation,
                        numeroTicket,
                        voyageur.getNom() + " " + voyageur.getPrenom(),
                        voyageur.getTelephone(),
                        voyage.getOrigine(),
                        voyage.getDestination(),
                        voyage.getDateHeureDepart().toString().substring(0, 10),
                        voyage.getImmatriculationBus(),
                        agenceDataRepository.findById(codeAgence)
                                .map(AgenceData::getLogoUrl).orElse(null)
                );

        String numeroPlace = (siegesAttribues != null && !siegesAttribues.isEmpty())
                ? String.valueOf(siegesAttribues.get(0))
                : null;
        ticket.setNumeroPlace(numeroPlace);
        ticket.setIdGuichetier(idGuichetier);
        ticketRepository.save(ticket);

        historiqueRepository.save(HistoriqueReservation.creer(
                reservation, TypeAction.CONFIRMATION, idGuichetier,
                "Paiement espèces guichet — billet=" + numeroTicket
                + " sièges=" + siegesAttribues));

        fideliteService.incrementer(reservation.getIdVoyageur(), reservation.getCodeAgence());

        seatLockManager.libererSieges(reservation.getIdVoyage(), siegesAttribues);

        eventPublisher.publierTicketGenerated(
                reservation.getIdVoyageur(),
                voyageur.getEmail(),
                "",
                numeroTicket,
                voyage.getOrigine(),
                voyage.getDestination(),
                voyage.getDateHeureDepart().toString().substring(0, 10)
        );

        log.info("[BOOKING] Billet embarquement guichet généré : {} sièges={} numeroPlace={}",
                numeroTicket, siegesAttribues, numeroPlace);
        return reservation;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ANNULER PAR L'UTILISATEUR
    // ─────────────────────────────────────────────────────────────────────────

    @Transactional
    public Reservation annulerReservation(Long bookingId, String idUtilisateur) {

        Reservation reservation = reservationRepository.findById(bookingId)
                .orElseThrow(() -> new RuntimeException(
                        "Réservation introuvable : " + bookingId));

        if (reservation.getStatut() == StatutReservation.EMBARQUEE) {
            throw new RuntimeException("Impossible d'annuler une réservation déjà embarquée.");
        }
        if (reservation.getStatut() == StatutReservation.ANNULEE) {
            throw new RuntimeException("Cette réservation est déjà annulée.");
        }

        boolean etaitPayee = reservation.getStatut() == StatutReservation.PAYEE
                || reservation.getStatut() == StatutReservation.CONFIRMEE;

        reservation.setStatut(StatutReservation.ANNULEE);
        reservationRepository.save(reservation);

        paiementRepository.findByReservationId(bookingId).ifPresent(p -> {
            p.setStatut(StatutPaiement.REMBOURSE);
            paiementRepository.save(p);
        });

        List<Integer> sieges = reservation.getPlacesReservees().stream()
                .map(PlaceReservee::getNumeroSiege)
                .collect(Collectors.toList());
        seatLockManager.libererSieges(reservation.getIdVoyage(), sieges);

        historiqueRepository.save(HistoriqueReservation.creer(
                reservation, TypeAction.ANNULATION,
                idUtilisateur,
                "Annulation par l'utilisateur — sièges " + sieges + " libérés"));

        if (etaitPayee) {
            eventPublisher.publierRemboursementDemande(
                    bookingId,
                    reservation.getIdVoyageur(),
                    reservation.getMontantTotal(),
                    reservation.getDevise(),
                    "Annulation par l'utilisateur id=" + idUtilisateur
            );
        }

        log.info("[BOOKING] Réservation annulée id={} par={} sièges={}",
                bookingId, idUtilisateur, sieges);
        return reservation;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CONVERTIR BILLET ÉLECTRONIQUE → EMBARQUEMENT
    // ─────────────────────────────────────────────────────────────────────────

    @Transactional
    public TicketEmbarquement convertirBilletElectronique(
            String numeroTicketElec, String idGuichetier) {

        Ticket ticketBase = ticketRepository.findByNumeroTicket(numeroTicketElec)
                .orElseThrow(() -> new RuntimeException(
                        "Billet introuvable : " + numeroTicketElec));

        if (!(ticketBase instanceof TicketElectronique ticketElec)) {
            throw new RuntimeException("Ce numéro ne correspond pas à un billet électronique.");
        }
        if (!ticketElec.validerTicket()) {
            throw new RuntimeException("Billet invalide ou déjà converti : " + numeroTicketElec);
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
                        ticketElec.getImmatriculationBus(),
                        agenceDataRepository.findById(reservation.getCodeAgence())
                                .map(AgenceData::getLogoUrl).orElse(null)
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
                "Conversion " + numeroTicketElec + " → " + numeroEmb));

        log.info("[BOOKING] Billet électronique converti : {} → {}", numeroTicketElec, numeroEmb);
        return ticketEmb;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // VALIDER UN BILLET AU DÉPART
    // ─────────────────────────────────────────────────────────────────────────

    @Transactional
    public Ticket validerBilletDepart(String numeroBillet, String idManager) {

        Ticket ticket = ticketRepository.findByNumeroTicket(numeroBillet)
                .orElseThrow(() -> new RuntimeException(
                        "Billet introuvable : " + numeroBillet));

        if (ticket.getStatut() == StatutTicket.EMBARQUEE) {
            throw new RuntimeException("Ce billet est déjà validé : " + numeroBillet);
        }
        if (ticket.getStatut() == StatutTicket.ANNULE) {
            throw new RuntimeException("Ce billet est annulé, embarquement refusé : " + numeroBillet);
        }
        if (ticket instanceof TicketElectronique te && !te.getConverti()) {
            throw new RuntimeException("Ce billet électronique doit d'abord être converti au guichet.");
        }

        ticket.marquerUtilise();
        ticketRepository.save(ticket);

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
    // CLÔTURER LE DÉPART
    // ─────────────────────────────────────────────────────────────────────────

    @Transactional
    public Map<String, Object> cloturerDepart(String idVoyage, String idManager) {

        List<Reservation> reservations = reservationRepository.findByIdVoyage(idVoyage);

        if (reservations.isEmpty()) {
            throw new RuntimeException("Aucune réservation trouvée pour le voyage " + idVoyage);
        }

        long passagersEmbarques = reservations.stream()
                .filter(r -> r.getStatut() == StatutReservation.EMBARQUEE)
                .count();

        long totalConfirmees = reservations.stream()
                .filter(r -> r.getStatut() == StatutReservation.EMBARQUEE
                        || r.getStatut() == StatutReservation.CONFIRMEE
                        || r.getStatut() == StatutReservation.PAYEE)
                .count();

        int totalPlaces = reservations.stream().mapToInt(Reservation::getNombrePlaces).sum();

        eventPublisher.publierDepartVoyage(idVoyage, idManager, (int) passagersEmbarques, totalPlaces);

        log.info("[DEPART] Voyage={} clôturé — {}/{} passagers embarqués",
                idVoyage, passagersEmbarques, totalConfirmees);

        return Map.of(
                "voyageId",           idVoyage,
                "passagersEmbarques", passagersEmbarques,
                "totalConfirmees",    totalConfirmees,
                "totalPlaces",        totalPlaces,
                "statut",             "DEPART_CLOTURE"
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PASSAGERS D'UN VOYAGE
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Retourne le manifeste complet des passagers d'un voyage :
     * <ul>
     *   <li>Résumé d'occupation (places totales, occupées, libres)</li>
     *   <li>Ensemble des numéros de sièges occupés</li>
     *   <li>Compteurs par canal (WEB vs GUICHET)</li>
     *   <li>Liste détaillée de chaque passager avec son siège et son canal de paiement</li>
     * </ul>
     *
     * <p>Les réservations ANNULEE et EXPIREE sont exclues.
     * Les verrous Redis (sièges EN_ATTENTE) sont également remontés dans les compteurs
     * afin de donner une vision temps réel.</p>
     *
     * @param idVoyage identifiant du voyage
     * @return {@link VoyagePassagersResponse}
     */
    @Transactional(readOnly = true)
    public VoyagePassagersResponse getPassagersVoyage(String idVoyage) {

        // ── 1. Résoudre la capacité du bus ────────────────────────────────────
        VoyageData voyageData = voyageDataRepository.findById(idVoyage)
                .orElseThrow(() -> new RuntimeException("Voyage introuvable : " + idVoyage));
        int capacite = resolverCapaciteBus(voyageData);

        // ── 2. Récupérer tous les passagers actifs via la projection ──────────
        List<ReservationRepository.PassagerProjection> projections =
                reservationRepository.findPassagersByVoyage(idVoyage, S_ANNULEE, S_EXPIREE);

        // ── 3. Construire les détails passagers ───────────────────────────────
        List<VoyagePassagersResponse.PassagerDetail> passagers = projections.stream()
                .map(p -> {
                    String canalLibelle = p.getCanal() == CanalReservation.WEB
                            ? "En ligne (mobile money)"
                            : "Guichet (espèces)";

                    return VoyagePassagersResponse.PassagerDetail.builder()
                            .numeroSiege(p.getNumeroSiege())
                            .nomPassager(p.getNomPassager())
                            .telephonePassager(p.getTelephonePassager())
                            .aBagage(Boolean.TRUE.equals(p.getABagage()))
                            .estResponsable(Boolean.TRUE.equals(p.getEstResponsable()))
                            .prixUnitaire(p.getPrixUnitaire() != null ? p.getPrixUnitaire() : 0.0)
                            .idVoyageur(p.getIdVoyageur())
                            .reservationId(p.getReservationId())
                            .statutReservation(p.getStatutReservation())
                            .canal(p.getCanal())
                            .canalLibelle(canalLibelle)
                            .montantTotal(p.getMontantTotal() != null ? p.getMontantTotal() : 0.0)
                            .devise(p.getDevise())
                            .codeAgence(p.getCodeAgence())
                            .codeFiliale(p.getCodeFiliale())
                            .dateReservation(p.getDateReservation())
                            .build();
                })
                .collect(Collectors.toList());

        // ── 4. Calculer les agrégats ──────────────────────────────────────────
        Set<Integer> siegesOccupes = projections.stream()
                .map(ReservationRepository.PassagerProjection::getNumeroSiege)
                .collect(Collectors.toCollection(TreeSet::new)); // TreeSet = trié

        long nbWeb     = passagers.stream().filter(p -> p.getCanal() == CanalReservation.WEB).count();
        long nbGuichet = passagers.stream().filter(p -> p.getCanal() == CanalReservation.GUICHET).count();

        long placesOccupees = siegesOccupes.size();
        long placesLibres   = Math.max(0, capacite - placesOccupees);

        log.info("[BOOKING] Manifeste voyage={} : {}/{} places occupées ({} WEB, {} guichet)",
                idVoyage, placesOccupees, capacite, nbWeb, nbGuichet);

        return VoyagePassagersResponse.builder()
                .voyageId(idVoyage)
                .capaciteTotale(capacite)
                .placesOccupees(placesOccupees)
                .placesLibres(placesLibres)
                .siegesOccupes(siegesOccupes)
                .nbPassagersWeb(nbWeb)
                .nbPassagersGuichet(nbGuichet)
                .passagers(passagers)
                .build();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // STATS PAR FILIALE
    // ─────────────────────────────────────────────────────────────────────────

    public ReservationStatsResponse getStatsFiliale(String codeFiliale) {

        List<ReservationRepository.StatutCount> counts =
                reservationRepository.countByStatutForFiliale(
                        codeFiliale, S_EN_ATTENTE, S_EXPIREE);

        long totalReservations = 0, confirmees = 0, annulees = 0,
             enAttente = 0, embarquees = 0;

        for (ReservationRepository.StatutCount sc : counts) {
            totalReservations += sc.getTotal();
            switch (sc.getStatut()) {
                case CONFIRMEE, PAYEE -> confirmees += sc.getTotal();
                case ANNULEE, EXPIREE -> annulees   += sc.getTotal();
                case EN_ATTENTE       -> enAttente  += sc.getTotal();
                case EMBARQUEE        -> {
                    embarquees += sc.getTotal();
                    confirmees += sc.getTotal();
                }
            }
        }

        double chiffreAffaires = reservationRepository.sumMontantByCodeFiliale(
                codeFiliale, S_PAYEE, S_CONFIRMEE, S_EMBARQUEE);
        long placesVendues     = reservationRepository.sumPlacesVenduesByCodeFiliale(
                codeFiliale, S_PAYEE, S_CONFIRMEE, S_EMBARQUEE);
        double tauxConversion  = totalReservations > 0
                ? Math.round((confirmees * 100.0 / totalReservations) * 10.0) / 10.0
                : 0.0;

        return ReservationStatsResponse.builder()
                .filialeId(null)
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
    // RECETTES AGENCE
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Retourne la ventilation des recettes d'une agence :
     * - Recette totale (WEB + GUICHET)
     * - Recette en ligne (WEB / mobile money)
     * - Recette guichet (espèces reçues localement)
     *
     * @param codeAgence code de l'agence (ex : "GEN", "BNM")
     * @param devise     devise d'affichage (null → "XAF")
     */
    @Transactional(readOnly = true)
    public RecettesResponse getRecettesAgence(String codeAgence, String devise) {

        double recetteTotale  = reservationRepository.sumRecetteTotaleByAgence(
                codeAgence, S_PAYEE, S_CONFIRMEE, S_EMBARQUEE);
        double recetteEnLigne = reservationRepository.sumRecetteByAgenceAndCanal(
                codeAgence, CanalReservation.WEB, S_PAYEE, S_CONFIRMEE, S_EMBARQUEE);
        double recetteGuichet = reservationRepository.sumRecetteByAgenceAndCanal(
                codeAgence, CanalReservation.GUICHET, S_PAYEE, S_CONFIRMEE, S_EMBARQUEE);

        long nbEnLigne  = 0;
        long nbGuichet  = 0;

        for (ReservationRepository.CanalCount cc :
                reservationRepository.countAndSumByCanal(
                        codeAgence, S_PAYEE, S_CONFIRMEE, S_EMBARQUEE)) {
            if (cc.getCanal() == CanalReservation.WEB)     nbEnLigne = cc.getTotal();
            if (cc.getCanal() == CanalReservation.GUICHET) nbGuichet = cc.getTotal();
        }

        double[] parts = calculerParts(recetteEnLigne, recetteGuichet, recetteTotale);

        log.info("[RECETTES] Agence={} total={} enLigne={} guichet={}",
                codeAgence, recetteTotale, recetteEnLigne, recetteGuichet);

        return RecettesResponse.builder()
                .code(codeAgence)
                .typeEntite("AGENCE")
                .recetteTotale(recetteTotale)
                .recetteEnLigne(recetteEnLigne)
                .recetteGuichet(recetteGuichet)
                .nbReservationsEnLigne(nbEnLigne)
                .nbReservationsGuichet(nbGuichet)
                .partEnLignePct(parts[0])
                .partGuichetPct(parts[1])
                .devise(devise != null ? devise : "XAF")
                .build();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // RECETTES FILIALE
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Retourne la ventilation des recettes d'une filiale :
     * - Recette totale (WEB + GUICHET)
     * - Recette en ligne (WEB / mobile money)
     * - Recette guichet (espèces reçues localement)
     *
     * @param codeFiliale code de la filiale (ex : "BYDE", "DKLA")
     * @param devise      devise d'affichage (null → "XAF")
     */
    @Transactional(readOnly = true)
    public RecettesResponse getRecettesFiliale(String codeFiliale, String devise) {

        double recetteTotale  = reservationRepository.sumRecetteTotaleByFiliale(
                codeFiliale, S_PAYEE, S_CONFIRMEE, S_EMBARQUEE);
        double recetteEnLigne = reservationRepository.sumRecetteByFilialeAndCanal(
                codeFiliale, CanalReservation.WEB, S_PAYEE, S_CONFIRMEE, S_EMBARQUEE);
        double recetteGuichet = reservationRepository.sumRecetteByFilialeAndCanal(
                codeFiliale, CanalReservation.GUICHET, S_PAYEE, S_CONFIRMEE, S_EMBARQUEE);

        long nbEnLigne  = 0;
        long nbGuichet  = 0;

        for (ReservationRepository.CanalCount cc :
                reservationRepository.countAndSumByCanalForFiliale(
                        codeFiliale, S_PAYEE, S_CONFIRMEE, S_EMBARQUEE)) {
            if (cc.getCanal() == CanalReservation.WEB)     nbEnLigne = cc.getTotal();
            if (cc.getCanal() == CanalReservation.GUICHET) nbGuichet = cc.getTotal();
        }

        double[] parts = calculerParts(recetteEnLigne, recetteGuichet, recetteTotale);

        log.info("[RECETTES] Filiale={} total={} enLigne={} guichet={}",
                codeFiliale, recetteTotale, recetteEnLigne, recetteGuichet);

        return RecettesResponse.builder()
                .code(codeFiliale)
                .typeEntite("FILIALE")
                .recetteTotale(recetteTotale)
                .recetteEnLigne(recetteEnLigne)
                .recetteGuichet(recetteGuichet)
                .nbReservationsEnLigne(nbEnLigne)
                .nbReservationsGuichet(nbGuichet)
                .partEnLignePct(parts[0])
                .partGuichetPct(parts[1])
                .devise(devise != null ? devise : "XAF")
                .build();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GETTERS
    // ─────────────────────────────────────────────────────────────────────────

    public Reservation getReservation(Long id) {
        return reservationRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Réservation introuvable : " + id));
    }

    public List<Reservation> getReservationsVoyage(String idVoyage) {
        return reservationRepository.findByIdVoyage(idVoyage);
    }

    public List<Reservation> getReservationsVoyageur(String idVoyageur) {
        return reservationRepository.findByIdVoyageur(idVoyageur);
    }

    public Map<String, Object> getSiegesVoyage(String idVoyage) {
        VoyageData voyage = voyageDataRepository.findById(idVoyage)
                .orElseThrow(() -> new RuntimeException("Voyage introuvable : " + idVoyage));

        int capacite = resolverCapaciteBus(voyage);

        Set<Integer> occupesDB    = reservationRepository.findSiegesOccupes(
                idVoyage, S_ANNULEE, S_EXPIREE);
        Set<Integer> occupesRedis = seatLockManager.getSiegesVerrouilles(idVoyage);

        Set<Integer> totalOccupes = new HashSet<>(occupesDB);
        totalOccupes.addAll(occupesRedis);

        List<Integer> disponibles = IntStream.rangeClosed(1, capacite)
                .filter(n -> !totalOccupes.contains(n))
                .boxed()
                .collect(Collectors.toList());

        return Map.of(
                "voyageId",    idVoyage,
                "capacite",    capacite,
                "disponibles", disponibles,
                "occupes",     new ArrayList<>(totalOccupes),
                "enAttente",   new ArrayList<>(occupesRedis),
                "libres",      disponibles.size()
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // HELPERS PRIVÉS
    // ─────────────────────────────────────────────────────────────────────────

    private List<Integer> attribuerSieges(String idVoyage, int capaciteBus,
                                          int nombrePlaces,
                                          List<Integer> siegesDemandes) {
        Set<Integer> occupesDB    = reservationRepository.findSiegesOccupes(
                idVoyage, S_ANNULEE, S_EXPIREE);
        Set<Integer> occupesRedis = seatLockManager.getSiegesVerrouilles(idVoyage);

        Set<Integer> totalOccupes = new HashSet<>(occupesDB);
        totalOccupes.addAll(occupesRedis);

        if (siegesDemandes != null && !siegesDemandes.isEmpty()) {
            for (int siege : siegesDemandes) {
                if (siege < 1 || siege > capaciteBus) {
                    throw new RuntimeException(
                            "Siège " + siege + " invalide (capacité bus : " + capaciteBus + ")");
                }
                if (totalOccupes.contains(siege)) {
                    throw new RuntimeException(
                            "Le siège " + siege + " est déjà réservé ou en cours de réservation.");
                }
            }
            if (siegesDemandes.size() != nombrePlaces) {
                throw new RuntimeException(
                        "Nombre de sièges demandés (" + siegesDemandes.size()
                        + ") ne correspond pas au nombre de places (" + nombrePlaces + ")");
            }
            return new ArrayList<>(siegesDemandes);
        }

        List<Integer> libres = IntStream.rangeClosed(1, capaciteBus)
                .filter(n -> !totalOccupes.contains(n))
                .boxed()
                .limit(nombrePlaces)
                .collect(Collectors.toList());

        if (libres.size() < nombrePlaces) {
            throw new RuntimeException(
                    "Impossible d'attribuer " + nombrePlaces + " siège(s) — "
                    + libres.size() + " siège(s) libre(s) restant(s)");
        }

        log.debug("[BOOKING] Sièges attribués automatiquement : {}", libres);
        return libres;
    }

    private int resolverCapaciteBus(VoyageData voyageData) {
        if (voyageData.getCapaciteBus() != null && voyageData.getCapaciteBus() > 0) {
            return voyageData.getCapaciteBus();
        }
        if (voyageData.getImmatriculationBus() != null) {
            return busDataRepository.findByImmatriculation(voyageData.getImmatriculationBus())
                    .map(BusData::getCapacite)
                    .orElseGet(() -> {
                        log.warn("[BOOKING] Bus '{}' absent — capacité par défaut 50",
                                voyageData.getImmatriculationBus());
                        return 50;
                    });
        }
        log.warn("[BOOKING] Capacité bus inconnue pour voyage {} — défaut 50", voyageData.getId());
        return 50;
    }

    private UserData resolverVoyageur(
            String idVoyageur, String nom, String prenom,
            String telephone, String email) {

        return userDataRepository.findById(idVoyageur)
                .orElseGet(() -> {
                    log.warn("[BOOKING] Voyageur {} absent — création à la volée", idVoyageur);
                    UserData nouveau = UserData.builder()
                            .id(idVoyageur)
                            .nom(nom      != null ? nom      : "Client")
                            .prenom(prenom  != null ? prenom  : "")
                            .telephone(telephone != null ? telephone : "")
                            .email(email    != null ? email   : "")
                            .adresse("")
                            .photoUrl("")
                            .role("VOYAGEUR")
                            .build();
                    userDataRepository.save(nouveau);
                    return nouveau;
                });
    }

    /**
     * Calcule les parts en ligne / guichet sur le total.
     *
     * @return double[0] = partEnLigne%, double[1] = partGuichet%
     */
    private double[] calculerParts(double enLigne, double guichet, double total) {
        if (total <= 0) return new double[]{0.0, 0.0};
        double pEnLigne  = Math.round((enLigne  / total * 100.0) * 10.0) / 10.0;
        double pGuichet  = Math.round((guichet  / total * 100.0) * 10.0) / 10.0;
        return new double[]{pEnLigne, pGuichet};
    }
}
