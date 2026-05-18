package com.njila.njila_proxy_service.filter;

import lombok.extern.slf4j.Slf4j;
import org.springframework.cloud.gateway.filter.GatewayFilter;
import org.springframework.cloud.gateway.filter.factory.AbstractGatewayFilterFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.http.server.reactive.ServerHttpResponse;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

/**
 * GatewayFilterFactory nommé "JwtAuthFilter".
 *
 * Spring Cloud Gateway dérive le nom depuis le nom de la classe
 * en retirant le suffixe "GatewayFilterFactory".
 * "JwtAuthFilterGatewayFilterFactory" → "JwtAuthFilter"  ✓
 *
 * Ce filtre vérifie uniquement la PRÉSENCE du header Authorization Bearer.
 * La validation complète du JWT (signature, expiration, rôle) est déléguée
 * à chaque microservice en aval (user-service, auth-service, fleet-service).
 */
@Slf4j
@Component
public class JwtAuthFilterFactory
        extends AbstractGatewayFilterFactory<JwtAuthFilterFactory.Config> {

    // ── Réponse JSON d'erreur ──────────────────────────────────────────────
    private static final String UNAUTHORIZED_BODY =
        "{\"error\":\"Token d'authentification manquant ou invalide.\","
        + "\"status\":401}";

    public JwtAuthFilterFactory() {
        super(Config.class);
    }

    @Override
    public GatewayFilter apply(Config config) {
        return (exchange, chain) -> {

            ServerHttpRequest  request  = exchange.getRequest();
            ServerHttpResponse response = exchange.getResponse();

            // ── 1. Laisser passer OPTIONS (CORS preflight) ────────────────
            if ("OPTIONS".equalsIgnoreCase(
                    request.getMethod() != null
                        ? request.getMethod().name()
                        : "")) {
                return chain.filter(exchange);
            }

            // ── 2. Lire le header Authorization ──────────────────────────
            String authHeader = request.getHeaders()
                .getFirst(HttpHeaders.AUTHORIZATION);

            // ── 3. Token absent ou mal formé → 401 immédiat ──────────────
            if (authHeader == null || !authHeader.startsWith("Bearer ")) {
                log.warn("[JwtAuthFilter] Token manquant sur : {} {}",
                    request.getMethod(),
                    request.getURI().getPath());

                response.setStatusCode(HttpStatus.UNAUTHORIZED);
                response.getHeaders()
                    .setContentType(MediaType.APPLICATION_JSON);

                byte[] bytes = UNAUTHORIZED_BODY.getBytes();
                var buffer = response.bufferFactory().wrap(bytes);
                return response.writeWith(Mono.just(buffer));
            }

            // ── 4. Token présent → transmettre au microservice ────────────
            log.debug("[JwtAuthFilter] Token présent, transmission vers {}",
                request.getURI().getPath());
            return chain.filter(exchange);
        };
    }

    /**
     * Classe de configuration vide.
     * Peut être étendue pour ajouter des paramètres dans application.properties,
     * par exemple une liste de chemins à exclure.
     */
    public static class Config {
        // Aucun paramètre requis pour l'instant
    }
}