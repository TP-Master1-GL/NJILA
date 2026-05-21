package com.njila.gateway.loadbalancer;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.HashSet;
import java.util.Set;

/**
 * Représente une instance de service dans l'algorithme NJANGA.
 * Encapsule les métriques de santé, de charge et de localisation
 * nécessaires au scoring multicritère.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NjangaInstance {

    /** Identifiant unique de l'instance (ex: "njila-auth-service:8081") */
    private String id;

    /** URL de base de l'instance (ex: "http://192.168.1.10:8081") */
    private String url;

    /** Nom du service Eureka (ex: "NJILA-AUTH-SERVICE") */
    private String serviceName;

    /** Région/ville où l'instance est déployée (ex: "Douala") */
    private String region;

    // ─── Métriques de santé ──────────────────────────────────────────

    /** Utilisation CPU [0.0 - 1.0] */
    @Builder.Default
    private double cpuUsage = 0.0;

    /** Utilisation mémoire [0.0 - 1.0] */
    @Builder.Default
    private double memoryUsage = 0.0;

    /** Nombre de connexions actives */
    @Builder.Default
    private int activeConnections = 0;

    /** Nombre maximum de connexions supportées */
    @Builder.Default
    private int maxConnections = 200;

    // ─── Sessions & Cache ────────────────────────────────────────────

    /** Sessions actives sur cette instance */
    @Builder.Default
    private Set<String> activeSessions = new HashSet<>();

    /** Routes/trajets mis en cache sur cette instance */
    @Builder.Default
    private Set<String> cachedRoutes = new HashSet<>();

    // ─── Méthodes utilitaires ────────────────────────────────────────

    /**
     * Vérifie si une session utilisateur est attachée à cette instance.
     */
    public boolean hasSession(String sessionId) {
        return sessionId != null && activeSessions != null && activeSessions.contains(sessionId);
    }

    /**
     * Vérifie si un trajet est en cache sur cette instance.
     */
    public boolean hasCachedRoute(String routeKey) {
        return routeKey != null && cachedRoutes != null && cachedRoutes.contains(routeKey);
    }
}
