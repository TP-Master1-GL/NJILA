package com.njila.njila_proxy_service.filter;

import com.njila.njila_proxy_service.service.TokenValidationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cloud.gateway.filter.GatewayFilter;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.core.Ordered;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.util.List;
import java.util.function.Predicate;

@Component
@RequiredArgsConstructor
@Slf4j
public class JwtAuthenticationFilter implements GatewayFilter, Ordered {

    private final TokenValidationService tokenValidationService;

    private static final List<String> PUBLIC_ROUTES = List.of(
        "/api/auth/register",
        "/api/auth/login",
        "/api/auth/refresh",
        "/api/auth/forgot-password",
        "/api/auth/reset-password",
        "/api/auth/health",
        "/api/users/health",
        "/api/avis/agence/",
        "/api/schema/",
        "/api/docs/"
    );

    private static final Predicate<String> isPublicRoute = path -> 
        PUBLIC_ROUTES.stream().anyMatch(path::startsWith);

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        ServerHttpRequest request = exchange.getRequest();
        String path = request.getURI().getPath();

        if (isPublicRoute.test(path)) {
            log.debug("[JWT] Route publique : {}", path);
            return chain.filter(exchange);
        }

        String authHeader = request.getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            log.warn("[JWT] Token manquant ou invalide pour : {}", path);
            exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
            return exchange.getResponse().setComplete();
        }

        String token = authHeader.substring(7);

        return tokenValidationService.validateToken(token)
            .flatMap(claims -> {
                if (claims == null || !claims.isValid()) {
                    log.warn("[JWT] Token invalide pour : {}", path);
                    exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
                    return exchange.getResponse().setComplete();
                }

                ServerHttpRequest mutatedRequest = request.mutate()
                    .header("X-User-Id", claims.getUserId())
                    .header("X-User-Role", claims.getRole())
                    .header("X-Session-Id", claims.getSessionId())
                    .header("X-Filiale-Id", claims.getFilialeId() != null ? claims.getFilialeId() : "")
                    .header("X-Agence-Id", claims.getAgenceId() != null ? claims.getAgenceId() : "")
                    .build();

                log.debug("[JWT] Token validé pour user: {}, role: {}", claims.getUserId(), claims.getRole());
                return chain.filter(exchange.mutate().request(mutatedRequest).build());
            })
            .onErrorResume(e -> {
                log.error("[JWT] Erreur validation token: {}", e.getMessage());
                exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
                return exchange.getResponse().setComplete();
            });
    }

    @Override
    public int getOrder() {
        return -100;
    }
}