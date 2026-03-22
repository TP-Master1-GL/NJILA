package com.njila.njila_booking_service.service.pricing;

import com.njila.njila_booking_service.domain.entity.Reservation;
import org.springframework.stereotype.Component;

@Component
public class PrixStandardStrategy implements PricingStrategy {

    @Override
    public double calculerPrix(Reservation reservation, double prixBase, int nombrePlaces) {
        return prixBase * nombrePlaces;
    }
}