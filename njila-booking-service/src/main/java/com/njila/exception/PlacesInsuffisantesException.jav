package com.njila.exception;

public class PlacesInsuffisantesException extends RuntimeException {
    public PlacesInsuffisantesException(String message) {
        super(message);
    }
    public PlacesInsuffisantesException(int demandees, int disponibles) {
        super("Places insuffisantes : " + demandees + " demandées, " + disponibles + " disponibles.");
    }
}