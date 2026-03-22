package com.njila.njila_booking_service.service.pricing;

import com.njila.njila_booking_service.domain.entity.Reservation;
import com.njila.njila_booking_service.service.FideliteService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class PrixPromoStrategy implements PricingStrategy {

    private final FideliteService fideliteService;

    @Override
    public double calculerPrix(Reservation reservation,
                                double prixBase,
                                int nombrePlaces) {

        boolean gratuit = fideliteService.estVoyageGratuit(
                reservation.getIdVoyageur(),
                reservation.getCodeAgence()
        );

        if (gratuit) {
            log.info("[PROMO] Voyage gratuit appliqué → voyageur={} agence={}",
                    reservation.getIdVoyageur(), reservation.getCodeAgence());
            return 0.0;
        }

        // Pas de voyage gratuit → prix normal
        return prixBase * nombrePlaces;
    }
}