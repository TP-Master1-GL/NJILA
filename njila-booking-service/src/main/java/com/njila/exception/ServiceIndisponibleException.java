package com.njila.exception;


public class ServiceIndisponibleException extends RuntimeException {
    public ServiceIndisponibleException(String serviceName, String operation) {
        super("Service '" + serviceName + "' indisponible pour l'opération : " + operation);
    }
    public ServiceIndisponibleException(String message) {
        super(message);
    }
}