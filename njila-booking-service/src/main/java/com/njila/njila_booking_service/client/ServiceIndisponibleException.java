package com.njila.njila_booking_service.client;

public class ServiceIndisponibleException extends RuntimeException {

    public ServiceIndisponibleException(String message) {
        super(message);
    }

    public ServiceIndisponibleException(String message, Throwable cause) {
        super(message, cause);
    }
}