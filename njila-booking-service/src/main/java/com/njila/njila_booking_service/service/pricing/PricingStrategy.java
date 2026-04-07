package com.njila.njila_booking_service.service.pricing;

import com.njila.njila_booking_service.domain.entity.Reservation;

public interface PricingStrategy {
    double calculerPrix(Reservation reservation, double prixBase, int nombrePlaces);
}