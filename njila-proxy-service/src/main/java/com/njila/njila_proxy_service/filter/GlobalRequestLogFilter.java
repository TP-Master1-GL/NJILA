package com.njila.njila_proxy_service.filter;

import lombok.extern.slf4j.Slf4j;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

/**
 * Filtre global de logging des requêtes/réponses.
 * Logge chaque requête entrante et la durée de traitement.
 * Implémente GlobalFilter (et non GatewayFilter) pour s'appliquer
 * automatiquement sur toutes les routes sans configuration explicite.
 */
@Component
@Slf4j
public class GlobalRequestLogFilter implements GlobalFilter, Ordered {

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        var request = exchange.getRequest();
        var startTime = System.currentTimeMillis();

        log.info("[REQUEST] {} {} from {}",
            request.getMethod(),
            request.getURI().getPath(),
            request.getRemoteAddress());

        return chain.filter(exchange)
            .doFinally(signalType -> {
                var duration = System.currentTimeMillis() - startTime;
                var response = exchange.getResponse();
                log.info("[RESPONSE] {} {} - Status: {} - Duration: {}ms",
                    request.getMethod(),
                    request.getURI().getPath(),
                    response.getStatusCode(),
                    duration);
            });
    }

    @Override
    public int getOrder() {
        // Ordre très bas pour s'exécuter en premier (avant JWT filter)
        return -200;
    }
}
