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

import java.util.Arrays;
import java.util.List;
import java.util.function.Predicate;

@Component
@RequiredArgsConstructor
@Slf4j
public class JwtAuthenticationFilter implements GatewayFilter, Ordered {

    private final TokenValidationService tokenValidationService;

    // Routes publiques (sans authentification) - Support avec et sans préfixe de service
    private static final List<String> PUBLIC_ROUTES = Arrays.asList(
        // Auth Service - avec préfixe Eureka
        "/njila-auth-service/api/auth/health",
        "/njila-auth-service/api/auth/register",
        "/njila-auth-service/api/auth/login",
        "/njila-auth-service/api/auth/refresh",
        "/njila-auth-service/api/auth/forgot-password",
        "/njila-auth-service/api/auth/reset-password",
        "/njila-auth-service/api/auth/logout",
        "/njila-auth-service/api/auth/validate-token",
        
        // Auth Service - sans préfixe (pour compatibilité)
        "/api/auth/health",
        "/api/auth/register",
        "/api/auth/login",
        "/api/auth/refresh",
        "/api/auth/forgot-password",
        "/api/auth/reset-password",
        "/api/auth/logout",
        "/api/auth/validate-token",
        
        // Auth Service - Documentation
        "/njila-auth-service/api/schema/",
        "/njila-auth-service/api/docs/",
        "/api/schema/",
        "/api/docs/",
        
        // User Service - Endpoints publics avec préfixe
        "/njila-user-service/api/users/health",
        "/njila-user-service/api/avis/agence/",
        "/njila-user-service/api/agences-filiales/",
        
        // User Service - sans préfixe
        "/api/users/health",
        "/api/avis/agence/",
        "/api/agences-filiales/",
        
        // Swagger et Actuator
        "/swagger-ui/",
        "/swagger-ui.html",
        "/v3/api-docs/",
        "/v3/api-docs",
        "/actuator/",
        "/actuator/health",
        "/actuator/info"
    );

    // Patterns pour les routes publiques avec wildcard
    private static final List<String> PUBLIC_PATTERNS = Arrays.asList(
        "/swagger-ui/**",
        "/v3/api-docs/**",
        "/actuator/**",
        "/njila-auth-service/api/schema/**",
        "/njila-auth-service/api/docs/**",
        "/njila-user-service/api/avis/agence/**",
        "/njila-user-service/api/agences-filiales/**",
        "/api/avis/agence/**",
        "/api/agences-filiales/**"
    );

    private static final Predicate<String> isPublicRoute = path -> {
        // Vérifier les routes exactes
        for (String route : PUBLIC_ROUTES) {
            if (path.startsWith(route)) {
                return true;
            }
        }
        // Vérifier les patterns
        for (String pattern : PUBLIC_PATTERNS) {
            String patternWithoutStars = pattern.replace("/**", "");
            if (path.startsWith(patternWithoutStars)) {
                return true;
            }
        }
        return false;
    };

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        ServerHttpRequest request = exchange.getRequest();
        String path = request.getURI().getPath();
        String method = request.getMethod().toString();

        // Extraire le nom du service du chemin (si présent)
        String serviceName = extractServiceName(path);
        String pathWithoutService = removeServicePrefix(path);

        log.debug("[JWT] Requête - Path: {}, Service: {}, CleanPath: {}", path, serviceName, pathWithoutService);

        // Vérifier si la route est publique
        if (isPublicRoute.test(path) || isPublicRoute.test(pathWithoutService)) {
            log.debug("[JWT] Route publique - {}: {}", method, path);
            return chain.filter(exchange);
        }

        // Vérifier la présence du token
        String authHeader = request.getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            log.warn("[JWT] Token manquant - {}: {}", method, path);
            exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
            return exchange.getResponse().setComplete();
        }

        String token = authHeader.substring(7);

        // Valider le token
        return tokenValidationService.validateToken(token)
            .flatMap(claims -> {
                if (claims == null || !claims.isValid()) {
                    log.warn("[JWT] Token invalide - {}: {}", method, path);
                    exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
                    return exchange.getResponse().setComplete();
                }

                // Ajouter les claims dans les headers pour les services en aval
                ServerHttpRequest mutatedRequest = request.mutate()
                    .header("X-User-Id", claims.getUserId() != null ? claims.getUserId() : "")
                    .header("X-User-Role", claims.getRole() != null ? claims.getRole() : "")
                    .header("X-Session-Id", claims.getSessionId() != null ? claims.getSessionId() : "")
                    .header("X-Filiale-Id", claims.getFilialeId() != null ? claims.getFilialeId() : "")
                    .header("X-Agence-Id", claims.getAgenceId() != null ? claims.getAgenceId() : "")
                    .build();

                log.debug("[JWT] Token validé - User: {}, Role: {}, Path: {}", 
                    claims.getUserId(), claims.getRole(), path);
                
                return chain.filter(exchange.mutate().request(mutatedRequest).build());
            })
            .onErrorResume(e -> {
                log.error("[JWT] Erreur validation token - Path: {}, Error: {}", path, e.getMessage());
                exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
                return exchange.getResponse().setComplete();
            });
    }

    private String extractServiceName(String path) {
        if (path != null && path.startsWith("/")) {
            String[] parts = path.substring(1).split("/", 2);
            if (parts.length > 0 && parts[0].endsWith("-service")) {
                return parts[0];
            }
        }
        return null;
    }

    private String removeServicePrefix(String path) {
        String serviceName = extractServiceName(path);
        if (serviceName != null) {
            String suffix = path.substring(serviceName.length() + 1);
            if (suffix.startsWith("/")) {
                return suffix;
            }
            return "/" + suffix;
        }
        return path;
    }

    @Override
    public int getOrder() {
        return -100;
    }
}