package com.njila.gateway.loadbalancer;

import io.micrometer.core.instrument.MeterRegistry;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.cloud.client.ServiceInstance;
import org.springframework.cloud.loadbalancer.core.ReactorLoadBalancer;
import org.springframework.cloud.loadbalancer.core.ServiceInstanceListSupplier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.core.ReactiveRedisTemplate;

/**
 * ============================================================
 * Configuration du LoadBalancer NJANGA
 * ============================================================
 * 
 * Cette classe configure le load balancer personnalisé NJANGA
 * pour tous les services découverts via Eureka.
 * 
 * ✅ IMPORTANT : @Configuration est REQUIS pour que Spring 
 *    scanne les méthodes @Bean
 * 
 * Dépendances injectées :
 *  - ServiceInstanceListSupplier : Liste des instances (Eureka)
 *  - ReactiveRedisTemplate : Opérations Redis asynchrones
 *  - GeoLocationService : Géolocalisation (optionnel)
 *  - MeterRegistry : Métriques Micrometer
 * 
 * @author Nguembu John
 * @version 1.0
 */
@Configuration
@Slf4j
public class NjangaLoadBalancerConfig {

    /**
     * Crée une instance de ReactorLoadBalancer NJANGA.
     * 
     * Cette méthode est appelée automatiquement par Spring lors du démarrage
     * pour créer le bean de load balancing qui sera utilisé pour toutes
     * les requêtes vers les services Eureka.
     * 
     * @param serviceInstanceListSupplier Supplier des instances du service (via Eureka)
     * @param reactiveRedisTemplate Template Redis réactif pour le cache et les stats
     * @param geoLocationServiceProvider Provider optionnel du service de géolocalisation
     * @param meterRegistry Registry Micrometer pour les métriques
     * 
     * @return Une instance de NjangaLoadBalancer configurée et prête à l'emploi
     * 
     * @throws IllegalStateException si les dépendances critiques (Redis, etc.) ne sont pas disponibles
     */
    @Bean
    public ReactorLoadBalancer<ServiceInstance> njangaLoadBalancer(
            ServiceInstanceListSupplier serviceInstanceListSupplier,
            ReactiveRedisTemplate<String, String> reactiveRedisTemplate,
            ObjectProvider<GeoLocationService> geoLocationServiceProvider,
            MeterRegistry meterRegistry) {
        
        log.info("═══════════════════════════════════════════════════════════");
        log.info("🔧 Initialisation du NjangaLoadBalancer");
        log.info("═══════════════════════════════════════════════════════════");
        
        // ─── Vérification et injection de ServiceInstanceListSupplier ─────
        if (serviceInstanceListSupplier == null) {
            String errorMsg = "❌ [ERROR] ServiceInstanceListSupplier est NULL\n\n" +
                "Cela signifie que Spring Cloud ne peut pas découvrir les instances.\n" +
                "Vérifiez que :\n" +
                "  1. Eureka est configuré et disponible\n" +
                "  2. Les services sont enregistrés dans Eureka\n" +
                "  3. @LoadBalancerClient ou @LoadBalancerClients est configuré";
            log.error(errorMsg);
            throw new IllegalStateException(errorMsg);
        }
        log.info("✅ ServiceInstanceListSupplier injecté");
        
        // ─── Vérification et injection de ReactiveRedisTemplate ──────────
        if (reactiveRedisTemplate == null) {
            String errorMsg = "❌ [ERROR] ReactiveRedisTemplate est NULL\n\n" +
                "Cela signifie que la configuration Redis n'a pas créé le bean.\n" +
                "Vérifiez que :\n" +
                "  1. RedisConfig.java existe dans le package config\n" +
                "  2. RedisConfig est annoté @Configuration\n" +
                "  3. Redis est accessible (docker-compose ps | grep redis)\n" +
                "  4. spring-boot-starter-data-redis-reactive est dans pom.xml\n" +
                "  5. Les paramètres Redis sont corrects dans application.properties";
            log.error(errorMsg);
            throw new IllegalStateException(errorMsg);
        }
        log.info("✅ ReactiveRedisTemplate injecté et fonctionnel");
        
        // ─── Injection optionnelle de GeoLocationService ─────────────────
        GeoLocationService geoLocationService = geoLocationServiceProvider.getIfAvailable();
        
        if (geoLocationService == null) {
            log.warn("⚠️ GeoLocationService n'a pas pu être trouvé");
            log.warn("   Utilisation d'une implémentation par défaut");
            log.warn("   Assurez-vous que GeoLocationServiceImpl est annoté @Service");
            
            // Fournir une implémentation par défaut
            geoLocationService = ip -> {
                log.debug("GeoLocationService par défaut : pas de région pour IP {}", ip);
                return null;
            };
        } else {
            log.info("✅ GeoLocationService injecté (type: {})", 
                    geoLocationService.getClass().getSimpleName());
        }
        
        // ─── Vérification et injection de MeterRegistry ────────────────
        if (meterRegistry == null) {
            String errorMsg = "❌ [ERROR] MeterRegistry est NULL\n\n" +
                "Cela signifie que Micrometer n'est pas configuré.\n" +
                "Vérifiez que :\n" +
                "  1. spring-boot-starter-actuator est dans pom.xml\n" +
                "  2. Les endpoints actuator sont activés dans application.properties";
            log.error(errorMsg);
            throw new IllegalStateException(errorMsg);
        }
        log.info("✅ MeterRegistry injecté");
        
        // ─── Création et retour du NjangaLoadBalancer ──────────────────
        log.info("═══════════════════════════════════════════════════════════");
        log.info("✅ [SUCCESS] NjangaLoadBalancer créé avec succès");
        log.info("   • ServiceInstanceListSupplier : OK");
        log.info("   • ReactiveRedisTemplate : OK");
        log.info("   • GeoLocationService : {}", 
                geoLocationService != null ? "OK" : "Fallback");
        log.info("   • MeterRegistry : OK");
        log.info("═══════════════════════════════════════════════════════════");
        
        return new NjangaLoadBalancer(
            serviceInstanceListSupplier,
            reactiveRedisTemplate,
            geoLocationService,
            meterRegistry,
            "NJILA"
        );
    }
}