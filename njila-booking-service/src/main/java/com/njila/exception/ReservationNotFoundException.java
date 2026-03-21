package com.njila.exception;

public class ReservationNotFoundException extends RuntimeException {
    public ReservationNotFoundException(String message) {
        super(message);
    }
    public ReservationNotFoundException(Long id) {
        super("Réservation introuvable avec l'identifiant : " + id);
    }
    public ReservationNotFoundException(String field, String value) {
        super("Réservation introuvable — " + field + " : " + value);
    }
}