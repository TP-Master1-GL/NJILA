package com.njila.gateway.loadbalancer;

import reactor.core.publisher.Mono;

/**
 * Interface de vérification de santé des instances pour l'algorithme NJANGA.
 * Retourne un Mono<Boolean> pour rester compatible avec le contexte réactif
 * de Spring Cloud Gateway (WebFlux / Netty).
 */
public interface NjangaHealthChecker {

    /**
     * Vérifie si une instance est en bonne santé (endpoint /actuator/health).
     *
     * @param instance l'instance à vérifier
     * @return Mono<true> si l'instance est UP, Mono<false> sinon
     */
    Mono<Boolean> estEnBonneSante(NjangaInstance instance);
}
