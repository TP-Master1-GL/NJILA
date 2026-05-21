package com.njila.gateway.loadbalancer;

/**
 * Exception levée par l'algorithme NJANGA lorsqu'aucune instance
 * saine n'est disponible pour un service donné.
 */
public class AucuneInstanceDisponibleException extends RuntimeException {

    private final String serviceName;

    public AucuneInstanceDisponibleException(String serviceName) {
        super("Aucune instance disponible pour le service : " + serviceName);
        this.serviceName = serviceName;
    }

    public String getServiceName() {
        return serviceName;
    }
}
