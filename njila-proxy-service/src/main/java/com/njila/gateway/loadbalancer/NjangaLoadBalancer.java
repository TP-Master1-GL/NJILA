package com.njila.gateway.loadbalancer;

import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cloud.client.ServiceInstance;
import org.springframework.cloud.client.loadbalancer.reactive.ReactiveLoadBalancer;
import org.springframework.cloud.loadbalancer.core.ReactorServiceInstanceLoadBalancer;
import org.springframework.cloud.loadbalancer.core.ServiceInstanceListSupplier;
import org.springframework.data.redis.core.ReactiveRedisTemplate;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.DayOfWeek;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * ============================================================
 * ALGORITHME NJANGA v3.1 — Production-Ready (Reactive)
 * ============================================================
 * Version corrigée pour fonctionner dans le contexte réactif
 * de Spring Cloud Gateway (WebFlux / Netty) :
 *   - ReactiveRedisTemplate au lieu de RedisTemplate
 *   - Aucun appel .block() — tout est en Mono/Flux
 *   - Implémente ReactorServiceInstanceLoadBalancer pour
 *     s'intégrer nativement dans le mécanisme lb:// de SCG
 *
 * Critères de scoring pondérés (somme = 1.0) :
 *   - Santé (CPU/RAM)       : 30%
 *   - Charge (connexions)   : 25%
 *   - Performance (latence) : 25%
 *   - Géographie            : 20%
 *   + Bonus spéciaux        : sticky session, équité, cache
 *
 * Complexité : O(n) linéaire en nombre d'instances
 *
 * @author  Nguembu John
 * @version 3.1
 * ============================================================
 */
@Slf4j
public class NjangaLoadBalancer implements ReactorServiceInstanceLoadBalancer {

    // ─── Poids des critères (somme = 1.0) ─────────────────────────
    private static final double POIDS_SANTE       = 0.30;
    private static final double POIDS_CHARGE      = 0.25;
    private static final double POIDS_PERFORMANCE = 0.25;
    private static final double POIDS_GEO         = 0.20;

    // ─── Seuils de performance (ms) ─────────────────────────────���──
    private static final long SEUIL_RAPIDE = 500;
    private static final long SEUIL_MOYEN  = 1500;
    private static final long SEUIL_LENT   = 3000;

    // ─── Seuils santé ──────────────────────────────────────────────
    private static final double SEUIL_CPU_CRITIQUE     = 0.80;
    private static final double SEUIL_MEMOIRE_CRITIQUE = 0.85;
    private static final double SEUIL_CHARGE_STICKY    = 0.70;

    // ─── TTL cache local (ms) ──────────────────────────────────────
    private static final long STATS_CACHE_TTL_MS = 5_000L;

    // ─── Format horodatage Redis ────────────────────────────────────
    private static final DateTimeFormatter FMT_MINUTE = DateTimeFormatter.ofPattern("yyyyMMddHHmm");
    private static final DateTimeFormatter FMT_DATE   = DateTimeFormatter.ISO_DATE;

    // ─── Périodes de pointe (Cameroun) ─────────────────────────────
    private static final Map<DayOfWeek, List<PlageHoraire>> PERIODES_POINTE = Map.of(
        DayOfWeek.FRIDAY,   List.of(new PlageHoraire(16, 20, 3.5), new PlageHoraire(12, 14, 2.0)),
        DayOfWeek.SATURDAY, List.of(new PlageHoraire(8,  12, 2.5), new PlageHoraire(15, 18, 2.0)),
        DayOfWeek.MONDAY,   List.of(new PlageHoraire(7,  10, 2.5), new PlageHoraire(16, 19, 2.0)),
        DayOfWeek.SUNDAY,   List.of(new PlageHoraire(15, 20, 2.0)),
        DayOfWeek.THURSDAY, List.of(new PlageHoraire(16, 19, 1.5))
    );

    // ─── Voisinage géographique camerounais (toutes les régions) ──
    private static final Map<String, List<String>> REGIONS_VOISINES = Map.ofEntries(
        Map.entry("Douala",      List.of("Littoral", "Ouest", "Sud-Ouest", "Centre")),
        Map.entry("Yaounde",     List.of("Centre", "Sud", "Est", "Littoral")),
        Map.entry("Garoua",      List.of("Nord", "Extreme-Nord", "Adamaoua")),
        Map.entry("Bafoussam",   List.of("Ouest", "Nord-Ouest", "Littoral")),
        Map.entry("Bamenda",     List.of("Nord-Ouest", "Ouest", "Sud-Ouest")),
        Map.entry("Maroua",      List.of("Extreme-Nord", "Nord")),
        Map.entry("Ngaoundere",  List.of("Adamaoua", "Nord", "Centre", "Est")),
        Map.entry("Bertoua",     List.of("Est", "Centre", "Sud", "Adamaoua")),
        Map.entry("Ebolowa",     List.of("Sud", "Centre", "Littoral")),
        Map.entry("Buea",        List.of("Sud-Ouest", "Littoral", "Nord-Ouest")),
        Map.entry("Limbe",       List.of("Sud-Ouest", "Littoral")),
        Map.entry("Kribi",       List.of("Sud", "Littoral")),
        Map.entry("Kumba",       List.of("Sud-Ouest", "Littoral", "Nord-Ouest"))
    );

    // ─── Facteurs par type de service ─────────────────��────────────
    private static final Map<String, Double> FACTEURS_SERVICE = Map.of(
        "njila-booking-service",  1.3,
        "njila-fleet-service",    1.5,
        "njila-payement-service", 1.2
    );

    // ─── Dépendances ─────────────────────────────────��─────────────
    private final ServiceInstanceListSupplier            serviceInstanceListSupplier;
    private final ReactiveRedisTemplate<String, String>  reactiveRedisTemplate;
    private final GeoLocationService                     geoLocationService;
    private final MeterRegistry                          meterRegistry;
    private final String                                 serviceId;

    /** Cache local des métriques d'instances */
    private final Map<String, CachedStats> statsCache = new ConcurrentHashMap<>();

    public NjangaLoadBalancer(ServiceInstanceListSupplier serviceInstanceListSupplier,
                              ReactiveRedisTemplate<String, String> reactiveRedisTemplate,
                              GeoLocationService geoLocationService,
                              MeterRegistry meterRegistry,
                              String serviceId) {
        this.serviceInstanceListSupplier = serviceInstanceListSupplier;
        this.reactiveRedisTemplate       = reactiveRedisTemplate;
        this.geoLocationService          = geoLocationService;
        this.meterRegistry               = meterRegistry;
        this.serviceId                   = serviceId;
        log.info("NJANGA v3.1 initialisé pour service={}", serviceId);
    }

    // ============================================================
    // POINT D'ENTRÉE — ReactorServiceInstanceLoadBalancer
    // ============================================================

    @Override
    public Mono<org.springframework.cloud.client.loadbalancer.Response<ServiceInstance>> choose(
            org.springframework.cloud.client.loadbalancer.Request request) {

        Timer.Sample timerSample = Timer.start(meterRegistry);

        return serviceInstanceListSupplier.get()
            .next()
            .flatMap(instances -> {
                if (instances == null || instances.isEmpty()) {
                    meterRegistry.counter("njanga.no_instance", "service", serviceId).increment();
                    return Mono.just((org.springframework.cloud.client.loadbalancer.Response<ServiceInstance>)
                        new org.springframework.cloud.client.loadbalancer.DefaultResponse(null));
                }

                // Convertir les ServiceInstance en NjangaInstance
                List<NjangaInstance> njangaInstances = instances.stream()
                    .map(this::convertToNjangaInstance)
                    .collect(Collectors.toList());

                // Extraire l'IP client depuis le request context si disponible
                String clientIp = extractClientIp(request);

                NjangaRequete requete = NjangaRequete.builder()
                    .clientIp(clientIp)
                    .serviceName(serviceId)
                    .build();

                // Scoring et sélection (réactif via Redis)
                return scorerEtSelectionner(njangaInstances, requete, instances)
                    .doFinally(signal -> timerSample.stop(
                        meterRegistry.timer("njanga.routing.duration", "service", serviceId)));
            });
    }

    // ============================================================
    // PIPELINE DE SCORING RÉACTIF
    // ============================================================

    private Mono<org.springframework.cloud.client.loadbalancer.Response<ServiceInstance>>
            scorerEtSelectionner(List<NjangaInstance> njangaInstances,
                                 NjangaRequete requete,
                                 List<ServiceInstance> originalInstances) {

        // Prédiction de charge (Redis réactif)
        return predireCharge(requete.getServiceName())
            .flatMap(chargePredite -> {
                // Récupérer les temps de réponse pour chaque instance depuis Redis
                List<Mono<Map.Entry<Integer, Double>>> scoringMonos = new ArrayList<>();

                for (int i = 0; i < njangaInstances.size(); i++) {
                    final int index = i;
                    NjangaInstance instance = njangaInstances.get(i);

                    Mono<Map.Entry<Integer, Double>> scoreMono =
                        getTempsReponseRecents(instance.getId())
                            .map(temps -> {
                                double score = calculerScoreNjanga(instance, requete, chargePredite, temps);
                                log.debug("NJANGA score {} → {}", instance.getId(), score);
                                return Map.entry(index, score);
                            });

                    scoringMonos.add(scoreMono);
                }

                // Exécuter tous les scorings en parallèle et sélectionner le meilleur
                return Flux.merge(scoringMonos)
                    .collectList()
                    .map(scores -> {
                        Map.Entry<Integer, Double> best = scores.stream()
                            .max(Map.Entry.comparingByValue())
                            .orElse(Map.entry(0, 0.0));

                        ServiceInstance selected = originalInstances.get(best.getKey());
                        log.info("NJANGA → {} (score={}) pour service={}",
                                 selected.getInstanceId(), best.getValue(), serviceId);

                        meterRegistry.counter("njanga.routing",
                            "service", serviceId,
                            "instance", selected.getInstanceId()).increment();

                        // Enregistrer la décision de manière asynchrone (fire-and-forget)
                        enregistrerDecision(requete, selected).subscribe();

                        return (org.springframework.cloud.client.loadbalancer.Response<ServiceInstance>)
                            new org.springframework.cloud.client.loadbalancer.DefaultResponse(selected);
                    });
            });
    }

    // ============================================================
    // SCORE MULTICRITÈRE PONDÉRÉ
    // ============================================================

    private double calculerScoreNjanga(NjangaInstance instance,
                                       NjangaRequete requete,
                                       double chargePredite,
                                       List<Long> tempsReponse) {

        double score = 0.0;
        score += calculerScoreSante(instance)                              * POIDS_SANTE;
        score += calculerScoreCharge(instance, chargePredite)              * POIDS_CHARGE;
        score += calculerScorePerformance(tempsReponse)                    * POIDS_PERFORMANCE;
        score += calculerScoreGeographique(instance, requete)              * POIDS_GEO;
        score += calculerBonusSpecial(instance, requete);

        return Math.min(1.0, Math.max(0.0, score));
    }

    // ─── Critère 1 : Santé ─────────────────────────────────────────
    private double calculerScoreSante(NjangaInstance instance) {
        if (instance.getCpuUsage() > SEUIL_CPU_CRITIQUE
                || instance.getMemoryUsage() > SEUIL_MEMOIRE_CRITIQUE) {
            return 0.3;
        }
        return (1 - instance.getCpuUsage()) * 0.6 + (1 - instance.getMemoryUsage()) * 0.4;
    }

    // ─── Critère 2 : Charge ────────────────────────────────────────
    private double calculerScoreCharge(NjangaInstance instance, double chargePredite) {
        int maxConn = instance.getMaxConnections();
        if (maxConn == 0) return 0.5;
        double capaciteRestante  = (maxConn - instance.getActiveConnections()) / (double) maxConn;
        double capaciteNecessaire = chargePredite * 0.30;
        if (capaciteNecessaire <= 0) return 1.0;
        if (capaciteRestante >= capaciteNecessaire) return 1.0;
        return Math.max(0.0, capaciteRestante / capaciteNecessaire);
    }

    // ─── Critère 3 : Performance (historique Redis) ────────────────
    private double calculerScorePerformance(List<Long> temps) {
        if (temps.isEmpty()) return 0.6; // Nouvelle instance : score neutre

        double moyenne = temps.stream().mapToLong(Long::longValue).average().orElse(1000.0);
        if (moyenne < SEUIL_RAPIDE) return 1.0;
        if (moyenne < SEUIL_MOYEN)  return 0.7;
        if (moyenne < SEUIL_LENT)   return 0.4;
        return 0.1;
    }

    // ─── Critère 4 : Géographie ──────────────────────────────────��─
    private double calculerScoreGeographique(NjangaInstance instance, NjangaRequete requete) {
        String regionClient   = geoLocationService.getRegion(requete.getClientIp());
        String regionInstance  = instance.getRegion();

        if (regionClient == null || regionInstance == null) return 0.5;
        if (regionClient.equalsIgnoreCase(regionInstance))  return 1.0;

        List<String> voisines = REGIONS_VOISINES.getOrDefault(regionClient, List.of());
        return voisines.contains(regionInstance) ? 0.8 : 0.4;
    }

    // ─── Bonus spéciaux ────────────────────────────────────────────
    private double calculerBonusSpecial(NjangaInstance instance, NjangaRequete requete) {
        double bonus = 0.0;

        // Bonus sticky session
        if (requete.requiresStickySession() && instance.hasSession(requete.getSessionId())) {
            double chargeActuelle = instance.getMaxConnections() > 0
                ? instance.getActiveConnections() / (double) instance.getMaxConnections() : 1.0;
            if (chargeActuelle < SEUIL_CHARGE_STICKY) {
                bonus += 0.15;
            }
        }

        // Bonus cache trajet
        if (requete.getRouteKey() != null && instance.hasCachedRoute(requete.getRouteKey())) {
            bonus += 0.10;
        }

        return bonus;
    }

    // ============================================================
    // PRÉDICTION DE CHARGE (RÉACTIF)
    // ============================================================

    private Mono<Double> predireCharge(String serviceName) {
        int heure = LocalTime.now().getHour();
        DayOfWeek jour = LocalDateTime.now().getDayOfWeek();

        double facteurCalendrier = PERIODES_POINTE
            .getOrDefault(jour, List.of()).stream()
            .filter(p -> heure >= p.debut() && heure <= p.fin())
            .mapToDouble(PlageHoraire::facteur)
            .findFirst().orElse(1.0);

        // Historique réel Redis (réactif)
        String key = "njanga:service:" + serviceName + ":total:" +
                     LocalDateTime.now().format(FMT_MINUTE);

        return reactiveRedisTemplate.opsForValue().get(key)
            .map(val -> {
                int req = Integer.parseInt(val);
                double facteurHistorique = calculerFacteurHistorique(req);
                double charge = 0.6 * facteurCalendrier + 0.4 * facteurHistorique;
                charge *= FACTEURS_SERVICE.getOrDefault(serviceName, 1.0);
                return charge;
            })
            .defaultIfEmpty(facteurCalendrier * FACTEURS_SERVICE.getOrDefault(serviceName, 1.0))
            .onErrorReturn(facteurCalendrier * FACTEURS_SERVICE.getOrDefault(serviceName, 1.0));
    }

    private double calculerFacteurHistorique(int req) {
        if (req < 50)  return 1.0;
        if (req < 150) return 1.5;
        if (req < 300) return 2.5;
        return 3.5;
    }

    // ============================================================
    // UTILITAIRES REDIS RÉACTIFS
    // ============================================================

    private Mono<List<Long>> getTempsReponseRecents(String instanceId) {
        String key = "njanga:responsetimes:" + instanceId;
        return reactiveRedisTemplate.opsForList().range(key, 0, 99)
            .map(val -> {
                try { return Long.parseLong(val); }
                catch (NumberFormatException e) { return 1000L; }
            })
            .collectList()
            .onErrorReturn(List.of()); // Fallback : liste vide → score neutre
    }

    /**
     * Enregistre le temps de réponse dans Redis (appelé après réception de la réponse).
     */
    public Mono<Void> enregistrerTempsReponse(String instanceId, long tempsMs) {
        String key = "njanga:responsetimes:" + instanceId;
        String keyReq = "njanga:requests:" + instanceId + ":" +
                        LocalDateTime.now().format(FMT_MINUTE);

        return reactiveRedisTemplate.opsForList().leftPush(key, String.valueOf(tempsMs))
            .then(reactiveRedisTemplate.opsForList().trim(key, 0, 99))
            .then(reactiveRedisTemplate.expire(key, Duration.ofHours(1)))
            .then(reactiveRedisTemplate.opsForValue().increment(keyReq))
            .then(reactiveRedisTemplate.expire(keyReq, Duration.ofMinutes(5)))
            .then()
            .onErrorResume(e -> {
                log.warn("NJANGA [Redis] enregistrerTempsReponse KO : {}", e.getMessage());
                return Mono.empty();
            });
    }

    /**
     * Enregistre la décision de routage (fire-and-forget).
     */
    private Mono<Void> enregistrerDecision(NjangaRequete requete, ServiceInstance instance) {
        String key = "njanga:decisions:" + LocalDateTime.now().format(FMT_DATE);
        String value = requete.getId() + "|" + instance.getInstanceId() + "|" +
                       requete.getServiceName() + "|" + LocalDateTime.now();

        return reactiveRedisTemplate.opsForList().leftPush(key, value)
            .then(reactiveRedisTemplate.expire(key, Duration.ofDays(7)))
            .then()
            .onErrorResume(e -> {
                log.warn("NJANGA [Redis] enregistrerDecision KO : {}", e.getMessage());
                return Mono.empty();
            });
    }

    // ============================================================
    // CONVERSION ServiceInstance → NjangaInstance
    // ============================================================

    private NjangaInstance convertToNjangaInstance(ServiceInstance si) {
        Map<String, String> metadata = si.getMetadata();
        String region = metadata.getOrDefault("region", "Douala");
        double cpu = parseDouble(metadata.getOrDefault("cpu-usage", "0.3"));
        double memory = parseDouble(metadata.getOrDefault("memory-usage", "0.4"));
        int activeConn = parseInt(metadata.getOrDefault("active-connections", "0"));
        int maxConn = parseInt(metadata.getOrDefault("max-connections", "200"));

        return NjangaInstance.builder()
            .id(si.getInstanceId() != null ? si.getInstanceId() : si.getHost() + ":" + si.getPort())
            .url(si.getUri().toString())
            .serviceName(si.getServiceId())
            .region(region)
            .cpuUsage(cpu)
            .memoryUsage(memory)
            .activeConnections(activeConn)
            .maxConnections(maxConn)
            .build();
    }

    private String extractClientIp(org.springframework.cloud.client.loadbalancer.Request request) {
        // En l'absence d'information dans le request context, retour null → score geo neutre
        return null;
    }

    private double parseDouble(String val) {
        try { return Double.parseDouble(val); }
        catch (Exception e) { return 0.5; }
    }

    private int parseInt(String val) {
        try { return Integer.parseInt(val); }
        catch (Exception e) { return 0; }
    }

    // ============================================================
    // CLASSES INTERNES
    // ============================================================

    private record PlageHoraire(int debut, int fin, double facteur) {}

    private record CachedStats(double cpu, double memory,
                                int activeConnections, long capturedAt) {
        boolean estExpire() {
            return System.currentTimeMillis() - capturedAt > STATS_CACHE_TTL_MS;
        }
        static CachedStats neutre() {
            return new CachedStats(0.5, 0.5, 0, System.currentTimeMillis());
        }
    }
}
