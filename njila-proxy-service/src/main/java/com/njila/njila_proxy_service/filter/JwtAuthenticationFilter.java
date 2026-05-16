package com.njila.njila_proxy_service.filter;

import com.njila.njila_proxy_service.service.TokenValidationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cloud.gateway.filter.GatewayFilter;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.core.Ordered;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

/**
 * JwtAuthenticationFilter — conservé pour compatibilité avec GatewayConfig.
 *
 * La logique JWT réelle est désormais dans JwtGlobalFilter (GlobalFilter)
 * qui s'applique automatiquement sur toutes les routes déclarées en properties.
 *
 * Ce GatewayFilter est un simple pass-through. Il peut être réactivé si
 * on revient à une configuration Java pure dans GatewayConfig.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class JwtAuthenticationFilter implements GatewayFilter, Ordered {

    private final TokenValidationService tokenValidationService;

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        // Pass-through : la validation JWT est gérée par JwtGlobalFilter
        return chain.filter(exchange);
    }

    @Override
    public int getOrder() {
        return -99;
    }
}