package com.njila.gateway.loadbalancer;

/**
 * Service de géolocalisation permettant de déterminer la région
 * d'un client à partir de son adresse IP.
 *
 * Utilisé par l'algorithme NJANGA pour le scoring géographique
 * (proximité client ↔ instance).
 */
public interface GeoLocationService {

    /**
     * Détermine la région/ville d'une adresse IP.
     *
     * @param ip adresse IP du client (IPv4 ou IPv6)
     * @return le nom de la ville/région, ou null si indéterminé
     */
    String getRegion(String ip);
}
