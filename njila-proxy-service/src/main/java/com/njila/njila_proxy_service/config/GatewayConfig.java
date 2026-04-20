package com.njila.njila_proxy_service.config;

import com.njila.njila_proxy_service.filter.GlobalRequestLogFilter;
import com.njila.njila_proxy_service.filter.JwtAuthenticationFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.cloud.gateway.route.RouteLocator;
import org.springframework.cloud.gateway.route.builder.RouteLocatorBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@RequiredArgsConstructor
public class GatewayConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final GlobalRequestLogFilter globalRequestLogFilter;

    @Bean
    public RouteLocator customRouteLocator(RouteLocatorBuilder builder) {
        return builder.routes()
            // Route pour le fallback seulement (pas de capture par défaut)
            .route("fallback-route", r -> r
                .path("/fallback/**")
                .filters(f -> f
                    .filter(globalRequestLogFilter))
                .uri("forward:/fallback"))
            .build();
    }
}