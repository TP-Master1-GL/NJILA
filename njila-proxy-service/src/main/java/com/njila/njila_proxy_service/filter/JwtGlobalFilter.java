package com.njila.njila_proxy_service.filter;

import com.njila.njila_proxy_service.service.TokenValidationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.util.List;

/**
 * Filtre global JWT — appliqué sur TOUTES les routes.
 * Laisse passer les routes publiques (login, register, health, etc.)
 * et valide le token JWT pour les routes privées via le auth-service.
 *
 * En cas de token valide, injecte les headers X-User-Id, X-User-Role,
 * X-Session-Id dans la requête transmise au service downstream.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class JwtGlobalFilter implements GlobalFilter, Ordered {

    private final TokenValidationService tokenValidationService;

    /** Routes publiques qui ne nécessitent PAS de JWT */
    private static final List<String> PUBLIC_PATHS = List.of(
        "/api/auth/register",
        "/api/auth/login",
        "/api/auth/refresh",
        "/api/auth/forgot-password",
        "/api/auth/reset-password",
        "/api/auth/health",
        "/api/auth/validate-token",
        "/api/auth/sync-admin",
        "/api/auth/schema",
        "/api/auth/docs",
        "/api/users/health",
        "/api/users/avis/agence",
        "/api/agences-filiales",
        "/api/users/schema",
        "/api/users/docs",
        "/api/notifications/health",
        "/api/notifications/schema",
        "/api/notifications/docs",
        "/fallback",
        "/actuator"
    );

    /** Préfixes de routes publiques en lecture seule (GET uniquement) */
    private static final List<String> PUBLIC_GET_PREFIXES = List.of(
        "/api/agences",
        "/api/filiales",
        "/api/bus",
        "/api/chauffeurs",
        "/api/trajets",
        "/api/voyages",
        "/api/annonces",
        "/api/avis",
        "/api/stats",
        "/api/health",
        "/api/schema",
        "/api/docs"
    );

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        ServerHttpRequest request = exchange.getRequest();
        String path = request.getURI().getPath();
        HttpMethod method = request.getMethod();

        // OPTIONS (preflight CORS) → toujours laisser passer
        if (method == HttpMethod.OPTIONS) {
            return chain.filter(exchange);
        }

        // Routes publiques → pas de JWT requis
        if (isPublicPath(path, method)) {
            return chain.filter(exchange);
        }

        // Extraire le token Bearer
        String authHeader = request.getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            log.warn("[JWT] Pas de token pour {} {}", method, path);
            return unauthorized(exchange);
        }

        String token = authHeader.substring(7);

        // Valider le token via le auth-service (appel réactif)
        return tokenValidationService.validateToken(token)
            .flatMap(claims -> {
                if (!claims.isValid()) {
                    log.warn("[JWT] Token invalide pour {} {}", method, path);
                    return unauthorized(exchange);
                }

                // Injecter les informations utilisateur dans les headers downstream
                ServerHttpRequest mutatedRequest = request.mutate()
                    .header("X-User-Id", claims.getUserId() != null ? claims.getUserId() : "")
                    .header("X-User-Role", claims.getRole() != null ? claims.getRole() : "")
                    .header("X-Session-Id", claims.getSessionId() != null ? claims.getSessionId() : "")
                    .header("X-Filiale-Id", claims.getFilialeId() != null ? claims.getFilialeId() : "")
                    .header("X-Agence-Id", claims.getAgenceId() != null ? claims.getAgenceId() : "")
                    .build();

                log.debug("[JWT] OK userId={} role={} → {} {}",
                          claims.getUserId(), claims.getRole(), method, path);

                return chain.filter(exchange.mutate().request(mutatedRequest).build());
            });
    }

    private boolean isPublicPath(String path, HttpMethod method) {
        // Vérifier les chemins publics exacts ou préfixes
        for (String publicPath : PUBLIC_PATHS) {
            if (path.startsWith(publicPath)) {
                return true;
            }
        }

        // Routes GET publiques (fleet service en lecture)
        if (method == HttpMethod.GET) {
            for (String prefix : PUBLIC_GET_PREFIXES) {
                if (path.startsWith(prefix)) {
                    return true;
                }
            }
        }

        return false;
    }

    private Mono<Void> unauthorized(ServerWebExchange exchange) {
        exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
        exchange.getResponse().getHeaders().add("Content-Type", "application/json");
        byte[] body = "{\"error\":\"Unauthorized\",\"message\":\"Token manquant ou invalide\"}".getBytes();
        return exchange.getResponse().writeWith(
            Mono.just(exchange.getResponse().bufferFactory().wrap(body))
        );
    }

    @Override
    public int getOrder() {
        // Exécuté avant les autres filtres (priorité haute)
        return -100;
    }
}
