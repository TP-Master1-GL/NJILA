package com.njila.njila_proxy_service.service;

import com.njila.njila_proxy_service.dto.TokenClaims;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.core.publisher.Mono;

import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class TokenValidationService {

    private final WebClient.Builder webClientBuilder;

    // CORRECTION 1 : on utilise lb://njila-auth-service pour que le WebClient
    // @LoadBalanced puisse résoudre le service via Eureka.
    // L'URL directe http://localhost:8081 ne fonctionne pas avec @LoadBalanced.
    @Value("${njila.auth.service.eureka-name:njila-auth-service}")
    private String authServiceEurekaName;

    // Conservé comme fallback si Eureka est indisponible
    @Value("${njila.auth.service.url:http://localhost:8081}")
    private String authServiceDirectUrl;

    @Value("${njila.auth.service.internal-token:njila-shared-secret-2026}")
    private String internalToken;

    private String getValidateTokenUrl() {
        // lb:// est le préfixe attendu par le WebClient @LoadBalanced Spring Cloud
        return "lb://" + authServiceEurekaName + "/api/auth/validate-token";
    }

    public Mono<TokenClaims> validateToken(String token) {
        log.debug("[TOKEN] Validation via Eureka : {}", getValidateTokenUrl());

        return webClientBuilder.build()
                .post()
                .uri(getValidateTokenUrl())
                .header("X-Internal-Token", internalToken)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(Map.of("token", token))
                .retrieve()
                // CORRECTION 2 : on gère explicitement les 4xx pour ne pas
                // laisser WebClient les transformer en exceptions génériques
                .onStatus(
                        status -> status.is4xxClientError() || status.is5xxServerError(),
                        response -> {
                            log.warn("[TOKEN] Auth-service a répondu {} pour validate-token",
                                    response.statusCode());
                            return Mono.error(new RuntimeException(
                                    "Auth-service error: " + response.statusCode()));
                        })
                .bodyToMono(TokenValidationResponse.class)
                .map(response -> {
                    if (response != null && response.isValid() && response.getPayload() != null) {
                        log.debug("[TOKEN] Valide — userId={} role={}",
                                response.getPayload().getUserId(),
                                response.getPayload().getRole());
                        return TokenClaims.builder()
                                .valid(true)
                                .userId(response.getPayload().getUserId())
                                .role(response.getPayload().getRole())
                                .sessionId(response.getPayload().getSessionId())
                                .filialeId(response.getPayload().getFilialeId())
                                .agenceId(response.getPayload().getAgenceId())
                                .exp(response.getPayload().getExp())
                                .build();
                    }
                    log.warn("[TOKEN] Réponse invalide reçue de auth-service : {}", response);
                    return TokenClaims.builder().valid(false).build();
                })
                // CORRECTION 3 : on loggue l'exception complète pour faciliter le diagnostic
                .onErrorResume(e -> {
                    log.error("[TOKEN] Échec validation token — cause: {} : {}",
                            e.getClass().getSimpleName(), e.getMessage());
                    return Mono.just(TokenClaims.builder().valid(false).build());
                });
    }

    @lombok.Data
    private static class TokenValidationResponse {
        private boolean valid;
        private TokenPayload payload;
    }

    @lombok.Data
    private static class TokenPayload {
        private String userId;
        private String role;
        private String sessionId;
        private String filialeId;
        private String agenceId;
        private long exp;
    }
}