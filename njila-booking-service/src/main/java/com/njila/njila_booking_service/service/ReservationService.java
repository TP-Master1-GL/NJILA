package com.njila.njila_booking_service.service;

import com.njila.njila_booking_service.client.FleetServiceClient;
import com.njila.njila_booking_service.client.UserServiceClient;
import com.njila.njila_booking_service.domain.entity.*;
import com.njila.njila_booking_service.domain.enums.*;
import com.njila.njila_booking_service.dto.request.CreerReservationRequest;
import com.njila.njila_booking_service.messaging.publisher.BookingEventPublisher;
import com.njila.njila_booking_service.repository.*;
import com.njila.njila_booking_service.service.factory.TicketElectroniqueFactory;
import com.njila.njila_booking_service.service.factory.TicketEmbarquementFactory;
import com.njila.njila_booking_service.service.pricing.*;
import jakarta.transaction.Transactional;
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
            List<CreerReservationRequest.MembreGroupeRequest> membres) {

        // 1. Vérifier disponibilité voyage (fleet-service REST)
        if (!fleetClient.verifierDisponibilite(idVoyage, nombrePlaces)) {
            throw new RuntimeException(
                    "Places insuffisantes pour le voyage " + idVoyage);
        }

        // 2. Créer et persister la réservation en EN_ATTENTE
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
                        .build()
        );

        // 3. Acquérir verrou Redis SETNX TTL 10 min (anti-doublon)
        if (!lockManager.acquerirVerrou(idVoyage, idVoyageur, saved.getId())) {
            reservationRepository.delete(saved);
            throw new RuntimeException(
                    "Une réservation est déjà en cours pour ce voyage.");
        }

        // 4. Récupérer infos voyage depuis fleet-service
        Map<String, Object> voyage  = fleetClient.getVoyage(idVoyage);
        double prixBase = Double.parseDouble(voyage.get("prix").toString());

        // 5. Choisir et appliquer la stratégie de prix
        PricingStrategy strategie = switch (typeTarif) {
            case GROUPE -> prixGroupe;
            case PROMO  -> prixPromo;
            default     -> prixStandard;
        };
        double montantTotal = strategie.calculerPrix(saved, prixBase, nombrePlaces);
        saved.setMontantTotal(montantTotal);

        // 6. Créer les places réservées
        //    6a. Place du responsable (celui qui a la CNI)
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

        //    6b. Places des membres du groupe (sans CNI — nom/prénom seulement)
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
                        .idVoyageur(null)   // pas de CNI
                        .build();
                saved.getPlacesReservees().add(place);
            }
        }

        reservationRepository.save(saved);

        // 7. Tracer dans l'historique
        historiqueRepository.save(HistoriqueReservation.creer(
                saved, TypeAction.CREATION, idVoyageur,
                "Canal=" + canal + " Tarif=" + typeTarif
                + " Places=" + nombrePlaces));

        log.info("[BOOKING] Réservation créée id={} canal={} tarif={} montant={}",
                saved.getId(), canal, typeTarif, montantTotal);

        // 8. Guichet → confirmer directement (paiement espèces immédiat)
        if (canal == CanalReservation.GUICHET) {
            return confirmerReservationGuichet(
                    saved, voyage, voyageur, idGuichetier, codeAgence, codeFiliale);
        }

        // 9. Web → publier booking.created → payment-service prend le relais
        eventPublisher.publierBookingCreated(
                saved.getId(), montantTotal, idVoyageur, idVoyage);

        return saved;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CONFIRMER GUICHET — paiement espèces → billet embarquement immédiat
    // ─────────────────────────────────────────────────────────────────────────

    @Transactional
    public Reservation confirmerReservationGuichet(
            Reservation reservation,
            Map<String, Object> voyage,
            Map<String, Object> voyageur,
            Long idGuichetier,
            String codeAgence,
            String codeFiliale) {

        // 1. Passer en PAYEE
        reservation.setStatut(StatutReservation.PAYEE);
        reservationRepository.save(reservation);

        // 2. Générer numéro billet embarquement
        String numeroTicket = ticketNumberGenerator
                .genererBilletEmbarquement(codeAgence, codeFiliale);

        // 3. Créer le billet d'embarquement via factory
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

        // 4. Tracer
        historiqueRepository.save(HistoriqueReservation.creer(
                reservation, TypeAction.CONFIRMATION, idGuichetier,
                "Paiement espèces guichet — billet=" + numeroTicket));

        // 5. Incrémenter compteur fidélité
        fideliteService.incrementer(
                reservation.getIdVoyageur(), reservation.getCodeAgence());

        // 6. Libérer verrou Redis
        lockManager.libererVerrou(
                reservation.getIdVoyage(), reservation.getIdVoyageur());

        // 7. Notifier notification-service
        eventPublisher.publierTicketGenerated(
                reservation.getIdVoyageur(),
                voyageur.get("email").toString(),
                "",   // pas de PDF pour le billet guichet
                numeroTicket,
                voyage.get("origine").toString(),
                voyage.get("destination").toString(),
                voyage.get("dateHeureDepart").toString().substring(0, 10)
        );

        log.info("[BOOKING] Billet embarquement guichet généré : {}", numeroTicket);
        return reservation;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CONFIRMER APRÈS PAIEMENT EN LIGNE (appelé par PaymentEventConsumer)
    // ─────────────────────────────────────────────────────────────────────────

    @Transactional
    public void confirmerApresPaiement(Long bookingId, String transactionId) {

        // 1. Récupérer la réservation
        Reservation reservation = reservationRepository.findById(bookingId)
                .orElseThrow(() -> new RuntimeException(
                        "Réservation introuvable : " + bookingId));

        // 2. Passer en PAYEE
        reservation.setStatut(StatutReservation.PAYEE);
        reservationRepository.save(reservation);

        // 3. Mettre à jour le paiement
        paiementRepository.findByReservationId(bookingId).ifPresent(p -> {
            p.setStatut(StatutPaiement.REUSSI);
            p.setReferenceTransaction(transactionId);
            paiementRepository.save(p);
        });

        // 4. Récupérer infos voyage + voyageur
        Map<String, Object> voyage   = fleetClient.getVoyage(reservation.getIdVoyage());
        Map<String, Object> voyageur = userClient.getVoyageur(reservation.getIdVoyageur());

        // 5. Générer numéro billet électronique
        String numeroTicket = ticketNumberGenerator
                .genererBilletElectronique(
                        reservation.getCodeAgence(),
                        reservation.getCodeFiliale());

        // 6. Créer le billet électronique via factory
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

        // 7. Générer le PDF
        byte[] pdf = pdfGeneratorService.genererBilletElectronique(ticket);
        ticket.setCheminPdf("/billets/" + numeroTicket + ".pdf");
        ticketRepository.save(ticket);

        // 8. Tracer
        historiqueRepository.save(HistoriqueReservation.creer(
                reservation, TypeAction.PAIEMENT,
                reservation.getIdVoyageur(),
                "Transaction=" + transactionId
                + " Billet=" + numeroTicket));

        // 9. Incrémenter compteur fidélité
        fideliteService.incrementer(
                reservation.getIdVoyageur(), reservation.getCodeAgence());

        // 10. Libérer verrou Redis
        lockManager.libererVerrou(
                reservation.getIdVoyage(), reservation.getIdVoyageur());

        // 11. Notifier notification-service (envoi email + SMS)
        eventPublisher.publierTicketGenerated(
                reservation.getIdVoyageur(),
                voyageur.get("email").toString(),
                ticket.getCheminPdf(),
                numeroTicket,
                voyage.get("origine").toString(),
                voyage.get("destination").toString(),
                voyage.get("dateHeureDepart").toString().substring(0, 10)
        );

        log.info("[BOOKING] Paiement confirmé — billet électronique généré : {}",
                numeroTicket);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ANNULER APRÈS ÉCHEC PAIEMENT (appelé par PaymentEventConsumer)
    // ─────────────────────────────────────────────────────────────────────────

    @Transactional
    public void annulerApresEchecPaiement(Long bookingId) {

        Reservation reservation = reservationRepository.findById(bookingId)
                .orElseThrow(() -> new RuntimeException(
                        "Réservation introuvable : " + bookingId));

        reservation.setStatut(StatutReservation.ANNULEE);
        reservationRepository.save(reservation);

        // Libérer verrou Redis
        lockManager.libererVerrou(
                reservation.getIdVoyage(), reservation.getIdVoyageur());

        // Mettre à jour paiement
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
    // ANNULER PAR L'UTILISATEUR OU LE MANAGER
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

        reservation.setStatut(StatutReservation.ANNULEE);
        reservationRepository.save(reservation);

        // Libérer le verrou si encore actif
        lockManager.libererVerrou(
                reservation.getIdVoyage(), reservation.getIdVoyageur());

        historiqueRepository.save(HistoriqueReservation.creer(
                reservation, TypeAction.ANNULATION,
                idUtilisateur, "Annulation par l'utilisateur"));

        log.info("[BOOKING] Réservation annulée id={} par utilisateur={}",
                bookingId, idUtilisateur);
        return reservation;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CONVERTIR BILLET ÉLECTRONIQUE → BILLET D'EMBARQUEMENT (au guichet)
    // ─────────────────────────────────────────────────────────────────────────

    @Transactional
    public TicketEmbarquement convertirBilletElectronique(
            String numeroTicketElec, Long idGuichetier) {

        // 1. Retrouver le billet électronique par son numéro unique
        Ticket ticketBase = ticketRepository.findByNumeroTicket(numeroTicketElec)
                .orElseThrow(() -> new RuntimeException(
                        "Billet introuvable : " + numeroTicketElec));

        if (!(ticketBase instanceof TicketElectronique ticketElec)) {
            throw new RuntimeException(
                    "Ce numéro ne correspond pas à un billet électronique.");
        }

        // 2. Valider le billet (pas déjà utilisé, pas déjà converti)
        if (!ticketElec.validerTicket()) {
            throw new RuntimeException(
                    "Billet invalide ou déjà converti : " + numeroTicketElec);
        }

        // 3. Marquer le billet électronique comme converti
        ticketElec.setConverti(true);
        ticketElec.setStatut(StatutTicket.VERIFIE);
        ticketRepository.save(ticketElec);

        // 4. Générer le nouveau numéro de billet embarquement
        Reservation reservation = ticketElec.getReservation();
        String numeroEmb = ticketNumberGenerator.genererBilletEmbarquement(
                reservation.getCodeAgence(), reservation.getCodeFiliale());

        // 5. Créer le billet d'embarquement via factory
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

        // 6. Lier les deux billets
        ticketElec.setIdTicketEmbarquement(ticketEmb.getId());
        ticketRepository.save(ticketElec);

        // 7. Mettre à jour statut réservation → CONFIRMEE
        reservation.setStatut(StatutReservation.CONFIRMEE);
        reservationRepository.save(reservation);

        // 8. Tracer
        historiqueRepository.save(HistoriqueReservation.creer(
                reservation, TypeAction.VERIFICATION_TICKET, idGuichetier,
                "Conversion billet électronique "
                + numeroTicketElec + " → embarquement " + numeroEmb));

        log.info("[BOOKING] Billet électronique converti : {} → {}",
                numeroTicketElec, numeroEmb);
        return ticketEmb;
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