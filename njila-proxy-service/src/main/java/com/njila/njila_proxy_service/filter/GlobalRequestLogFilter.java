package com.njila.njila_proxy_service.filter;

import lombok.extern.slf4j.Slf4j;
import org.springframework.cloud.gateway.filter.GatewayFilter;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.core.Ordered;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

@Component
@Slf4j
public class GlobalRequestLogFilter implements GatewayFilter, Ordered {

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
        return -200;
    }
}