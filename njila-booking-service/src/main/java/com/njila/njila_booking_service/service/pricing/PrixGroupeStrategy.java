package com.njila.njila_booking_service.service.pricing;

import com.njila.njila_booking_service.domain.entity.Reservation;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Component
@Slf4j
public class PrixGroupeStrategy implements PricingStrategy {

    // Pas de réduction — prix unitaire x nombre de places
    @Override
    public double calculerPrix(Reservation reservation,
                                double prixBase,
                                int nombrePlaces) {
        log.info("[GROUPE] {} places x {} FCFA = {} FCFA",
                nombrePlaces, prixBase, prixBase * nombrePlaces);
        return prixBase * nombrePlaces;
    }
}