package com.njila.njila_booking_service.scheduler;

import com.njila.njila_booking_service.service.ReservationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Scheduler qui expire les réservations WEB EN_ATTENTE dont le délai de
 * paiement est dépassé (payment-service n'a pas répondu dans le temps imparti).
 *
 * Ces réservations sont supprimées physiquement de la BDD et leurs sièges
 * sont libérés, exactement comme lors d'un échec de paiement.
 *
 * Le TTL Redis du SeatLockManager doit être configuré à la même valeur que
 * ReservationService.PAIEMENT_TIMEOUT_MINUTES pour rester cohérent.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ReservationExpirationScheduler {

    private final ReservationService reservationService;

    /**
     * Exécuté toutes les 60 secondes.
     * fixedDelay garantit qu'une exécution se termine avant que
     * la prochaine ne démarre (pas de chevauchement).
     */
    @Scheduled(fixedDelay = 60_000)
    public void expirer() {
        log.debug("[SCHEDULER] Vérification des réservations expirées...");
        try {
            reservationService.expirerReservationsEnAttente();
        } catch (Exception e) {
            log.error("[SCHEDULER] Erreur lors de l'expiration des réservations : {}",
                    e.getMessage(), e);
        }
    }
}
