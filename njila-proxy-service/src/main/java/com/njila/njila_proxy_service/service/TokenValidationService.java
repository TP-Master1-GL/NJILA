package com.njila.njila_proxy_service.service;

import com.njila.njila_proxy_service.dto.TokenClaims;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class TokenValidationService {

    private final WebClient.Builder webClientBuilder;

    @Value("${njila.auth.service.validate-token-url}")
    private String validateTokenUrl;

    @Value("${njila.auth.service.internal-token}")
    private String internalToken;

    public Mono<TokenClaims> validateToken(String token) {
        return webClientBuilder.build()
            .post()
            .uri(validateTokenUrl)
            .header("X-Internal-Token", internalToken)
            .contentType(MediaType.APPLICATION_JSON)
            .bodyValue(Map.of("token", token))
            .retrieve()
            .bodyToMono(TokenValidationResponse.class)
            .map(response -> {
                if (response.isValid() && response.getPayload() != null) {
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
                return TokenClaims.builder().valid(false).build();
            })
            .onErrorResume(e -> {
                log.error("[TOKEN] Erreur validation: {}", e.getMessage());
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