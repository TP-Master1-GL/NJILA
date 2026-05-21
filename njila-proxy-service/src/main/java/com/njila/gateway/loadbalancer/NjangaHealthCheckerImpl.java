package com.njila.gateway.loadbalancer;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.time.Duration;

/**
 * Implémentation réactive du NjangaHealthChecker.
 * Interroge l'endpoint /actuator/health de chaque instance
 * avec un timeout de 2 secondes — sans jamais appeler .block().
 */
@Slf4j
@Service
public class NjangaHealthCheckerImpl implements NjangaHealthChecker {

    private final WebClient webClient;

    public NjangaHealthCheckerImpl(WebClient.Builder builder) {
        this.webClient = builder.build();
    }

    @Override
    public Mono<Boolean> estEnBonneSante(NjangaInstance instance) {
        return webClient.get()
            .uri(instance.getUrl() + "/actuator/health")
            .retrieve()
            .bodyToMono(String.class)
            .timeout(Duration.ofSeconds(2))
            .map(body -> body != null && body.contains("\"status\":\"UP\""))
            .onErrorResume(e -> {
                log.warn("Health check KO pour {} : {}", instance.getId(), e.getMessage());
                return Mono.just(false);
            });
    }
}
