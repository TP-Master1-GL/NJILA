package com.njila.gateway.loadbalancer;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

/**
 * Représente une requête entrante dans l'algorithme NJANGA.
 * Contient les informations nécessaires au scoring :
 * IP client (géolocalisation), service cible, session, route demandée.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NjangaRequete {

    /** Identifiant unique de la requête (UUID) */
    @Builder.Default
    private String id = UUID.randomUUID().toString();

    /** Adresse IP du client */
    private String clientIp;

    /** Nom du service cible (ex: "njila-booking-service") */
    private String serviceName;

    /** ID de session (pour sticky session) */
    private String sessionId;

    /** Clé de route/trajet demandé (pour bonus cache) */
    private String routeKey;

    /** Indique si la requête nécessite une sticky session */
    @Builder.Default
    private boolean requiresStickySession = false;

    /**
     * Vérifie si la requête nécessite une sticky session.
     * Nommé ainsi pour compatibilité avec Lombok @Data (getter boolean).
     */
    public boolean requiresStickySession() {
        return requiresStickySession;
    }
}
