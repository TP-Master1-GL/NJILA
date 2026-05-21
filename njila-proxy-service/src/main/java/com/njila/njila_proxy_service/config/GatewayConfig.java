package com.njila.njila_proxy_service.config;

import org.springframework.context.annotation.Configuration;

/**
 * GatewayConfig — version minimale.
 *
 * Toutes les routes métier sont déclarées dans njila-proxy-service.properties
 * (chargé depuis le Config Server).
 *
 * Les filtres globaux (JwtGlobalFilter, GlobalRequestLogFilter) s'appliquent
 * automatiquement sur toutes les routes via l'interface GlobalFilter.
 *
 * La route fallback est également déclarée dans le properties (route[16]).
 * Plus besoin de la redéclarer ici en Java.
 */
@Configuration
public class GatewayConfig {
    // Configuration vide — tout est géré via properties + GlobalFilters
}
