package com.njila.njila_proxy_service.config;

import com.njila.njila_proxy_service.filter.GlobalRequestLogFilter;
import com.njila.njila_proxy_service.filter.JwtAuthenticationFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.cloud.gateway.route.RouteLocator;
import org.springframework.cloud.gateway.route.builder.RouteLocatorBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * GatewayConfig — version minimale.
 *
 * Toutes les routes métier sont déclarées dans njila-proxy-service.properties
 * (chargé depuis le Config Server GitHub).
 *
 * Ce bean ne déclare que la route fallback interne pour éviter tout conflit
 * avec les routes définies en properties.
 *
 * Le JwtAuthenticationFilter est appliqué automatiquement par Spring Cloud
 * Gateway via la configuration des routes dans le properties grâce au
 * GlobalFilter déclaré dans JwtGlobalFilter.
 */
@Configuration
@RequiredArgsConstructor
public class GatewayConfig {

    private final GlobalRequestLogFilter globalRequestLogFilter;

    @Bean
    public RouteLocator customRouteLocator(RouteLocatorBuilder builder) {
        return builder.routes()
            // Route fallback interne uniquement
            .route("fallback-internal", r -> r
                .path("/fallback/**")
                .filters(f -> f.filter(globalRequestLogFilter))
                .uri("forward:/fallback"))
            .build();
    }
}