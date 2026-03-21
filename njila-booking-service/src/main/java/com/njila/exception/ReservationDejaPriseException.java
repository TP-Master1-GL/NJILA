package com.njila.exception;

public class ReservationDejaPriseException extends RuntimeException {
    public ReservationDejaPriseException(Long voyageId, Long voyageurId) {
        super("Une réservation est déjà en cours pour le voyage " + voyageId +
        " par le voyageur " + voyageurId + ". Veuillez patienter.");
    }
    public ReservationDejaPriseException(String message) {
        super(message);
    }
}
