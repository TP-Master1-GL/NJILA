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
            // Auth Service
            .route("auth-service", r -> r
                .path("/api/auth/**", "/api/schema/**", "/api/docs/**")
                .filters(f -> f
                    .filter(globalRequestLogFilter)
                    .circuitBreaker(config -> config
                        .setName("authServiceCB")
                        .setFallbackUri("forward:/fallback/auth")))
                .uri("lb://njila-auth-service"))

            // User Service
            .route("user-service", r -> r
                .path("/api/users/**", "/api/agences-filiales/**", "/api/avis/**")
                .filters(f -> f
                    .filter(globalRequestLogFilter)
                    .filter(jwtAuthenticationFilter)
                    .circuitBreaker(config -> config
                        .setName("userServiceCB")
                        .setFallbackUri("forward:/fallback/user")))
                .uri("lb://njila-user-service"))

            // Fleet Service
            .route("fleet-service", r -> r
                .path("/api/agences/**", "/api/filiales/**", "/api/bus/**", 
                      "/api/chauffeurs/**", "/api/guichetiers/**", "/api/trajets/**", 
                      "/api/voyages/**", "/api/annonces/**")
                .filters(f -> f
                    .filter(globalRequestLogFilter)
                    .filter(jwtAuthenticationFilter)
                    .circuitBreaker(config -> config
                        .setName("fleetServiceCB")
                        .setFallbackUri("forward:/fallback/fleet")))
                .uri("lb://njila-fleet-service"))

            // Booking Service
            .route("booking-service", r -> r
                .path("/api/bookings/**")
                .filters(f -> f
                    .filter(globalRequestLogFilter)
                    .filter(jwtAuthenticationFilter)
                    .circuitBreaker(config -> config
                        .setName("bookingServiceCB")
                        .setFallbackUri("forward:/fallback/booking")))
                .uri("lb://njila-booking-service"))

            // Payment Service
            .route("payment-service", r -> r
                .path("/api/payments/**", "/api/paiement/**")
                .filters(f -> f
                    .filter(globalRequestLogFilter)
                    .filter(jwtAuthenticationFilter)
                    .circuitBreaker(config -> config
                        .setName("paymentServiceCB")
                        .setFallbackUri("forward:/fallback/payment")))
                .uri("lb://njila-payement-service"))

            // Notification Service
            .route("notification-service", r -> r
                .path("/api/notifications/**")
                .filters(f -> f
                    .filter(globalRequestLogFilter)
                    .filter(jwtAuthenticationFilter)
                    .circuitBreaker(config -> config
                        .setName("notificationServiceCB")
                        .setFallbackUri("forward:/fallback/notification")))
                .uri("lb://njila-notification-service"))

            // Subscribe Service
            .route("subscribe-service", r -> r
                .path("/api/subscribe/**")
                .filters(f -> f
                    .filter(globalRequestLogFilter)
                    .filter(jwtAuthenticationFilter)
                    .circuitBreaker(config -> config
                        .setName("subscribeServiceCB")
                        .setFallbackUri("forward:/fallback/subscribe")))
                .uri("lb://njila-subscribe-service"))

            .build();
    }
}