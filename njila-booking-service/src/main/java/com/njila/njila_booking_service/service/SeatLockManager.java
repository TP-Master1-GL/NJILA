package com.njila.njila_booking_service.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Gestionnaire de verrous Redis au niveau du siège.
 *
 * Principe :
 *  - Clé : "njila:seat:lock:{idVoyage}:{numeroSiege}"
 *  - Valeur : idVoyageur (pour traçabilité)
 *  - TTL : 30 minutes (expire automatiquement si paiement non abouti dans ce délai)
 *
 * Pourquoi 30 minutes ?
 *  - Donne suffisamment de temps à l'utilisateur pour finaliser son paiement
 *  - Évite les blocages trop longs en cas d'abandon de panier
 *  - Protection contre les réservations malveillantes (DDOS)
 *
 * Avantages vs l'ancien verrou par (voyage, voyageur) :
 *  - Deux voyageurs peuvent réserver des sièges différents simultanément.
 *  - Un guichetier et un client web peuvent réserver en même temps.
 *  - Seul le même siège exact bloque deux demandes concurrentes.
 *
 * Thread-safety : RedisTemplate est thread-safe, setIfAbsent est atomique côté Redis.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SeatLockManager {

    private final RedisTemplate<String, String> redisTemplate;

    private static final String KEY_TEMPLATE   = "njila:seat:lock:%s:%d";
    private static final String SCAN_PATTERN   = "njila:seat:lock:%s:*";
    
    /**
     * Durée de vie d'un verrou de siège.
     * - 30 minutes = délai suffisant pour qu'un utilisateur finalise son paiement
     * - Au-delà, le siège est automatiquement libéré par Redis
     * - La réservation sera annulée par le système si le paiement n'est pas confirmé
     */
    private static final Duration DUREE_VERROU = Duration.ofMinutes(30);

    // ─────────────────────────────────────────────────────────────────────────
    // ACQUISITION — liste de sièges
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Tente d'acquérir les verrous pour tous les sièges demandés (opération tout-ou-rien).
     *
     * Si un siège est déjà verrouillé par quelqu'un d'autre, tous les verrous
     * éventuellement acquis dans cette tentative sont immédiatement libérés
     * (rollback partiel) et la méthode retourne false.
     *
     * @param idVoyage      UUID du voyage
     * @param idVoyageur    UUID du demandeur (pour traçabilité)
     * @param numeros       liste des numéros de sièges à verrouiller (1..capacité)
     * @return true si tous les verrous ont été acquis, false sinon
     */
    public boolean acquerirVerrouSieges(String idVoyage, String idVoyageur,
                                        List<Integer> numeros) {
        List<Integer> acquis = new ArrayList<>();

        for (int numero : numeros) {
            String cle     = getCle(idVoyage, numero);
            Boolean locked = redisTemplate.opsForValue()
                    .setIfAbsent(cle, idVoyageur, DUREE_VERROU);

            if (Boolean.TRUE.equals(locked)) {
                acquis.add(numero);
                log.debug("[SEAT-LOCK] Siège verrouillé : voyage={} siège={} voyageur={} TTL={} min",
                        idVoyage, numero, idVoyageur, DUREE_VERROU.toMinutes());
            } else {
                // Ce siège est pris — on libère tout ce qu'on a acquis
                String occupant = redisTemplate.opsForValue().get(cle);
                Long ttlRestant = redisTemplate.getExpire(cle);
                log.warn("[SEAT-LOCK] Siège {} déjà verrouillé par {} (TTL restant: {}s) — rollback {} siège(s)",
                        numero, occupant, ttlRestant, acquis.size());
                libererSieges(idVoyage, acquis);
                return false;
            }
        }

        log.info("[SEAT-LOCK] {} siège(s) verrouillé(s) pour voyage={} voyageur={} (TTL: {} minutes)",
                acquis.size(), idVoyage, idVoyageur, DUREE_VERROU.toMinutes());
        return true;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // LIBÉRATION
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Libère les verrous d'une liste de sièges précis.
     * Appelé après paiement, annulation, ou expiration de session.
     */
    public void libererSieges(String idVoyage, List<Integer> numeros) {
        for (int numero : numeros) {
            String cle = getCle(idVoyage, numero);
            
            // Vérifier si le verrou existe avant suppression pour logging
            if (Boolean.TRUE.equals(redisTemplate.hasKey(cle))) {
                String occupant = redisTemplate.opsForValue().get(cle);
                redisTemplate.delete(cle);
                log.debug("[SEAT-LOCK] Siège libéré : voyage={} siège={} occupé par={}",
                        idVoyage, numero, occupant);
            } else {
                log.debug("[SEAT-LOCK] Siège déjà libéré : voyage={} siège={}", idVoyage, numero);
            }
        }
        if (!numeros.isEmpty()) {
            log.info("[SEAT-LOCK] {} siège(s) libéré(s) pour voyage={}", numeros.size(), idVoyage);
        }
    }

    /**
     * Libère tous les verrous d'un voyage (utile pour annulation massive)
     */
    public void libererTousSieges(String idVoyage) {
        Set<Integer> siegesVerrouilles = getSiegesVerrouilles(idVoyage);
        if (!siegesVerrouilles.isEmpty()) {
            List<Integer> numeros = new ArrayList<>(siegesVerrouilles);
            libererSieges(idVoyage, numeros);
            log.info("[SEAT-LOCK] Tous les verrous libérés pour voyage={} ({} sièges)",
                    idVoyage, numeros.size());
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CONSULTATION
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Retourne l'ensemble des numéros de sièges actuellement verrouillés pour un voyage.
     * Utilisé par le service pour trouver les sièges disponibles à attribuer.
     *
     * Note : scan() est O(N) — acceptable car la capacité d'un bus est ≤ 100 sièges.
     */
    public Set<Integer> getSiegesVerrouilles(String idVoyage) {
        String pattern = String.format(SCAN_PATTERN, idVoyage);

        // KEYS est bloquant — pour un bus ≤100 sièges, le coût est négligeable.
        // En production haute-charge, remplacer par un SCAN itératif.
        Set<String> cles = redisTemplate.keys(pattern);

        if (cles == null || cles.isEmpty()) {
            return Set.of();
        }

        return cles.stream()
                .map(cle -> {
                    String[] parts = cle.split(":");
                    return Integer.parseInt(parts[parts.length - 1]);
                })
                .collect(Collectors.toSet());
    }

    /**
     * Vérifie si un siège précis est verrouillé.
     */
    public boolean estVerrouille(String idVoyage, int numeroSiege) {
        return Boolean.TRUE.equals(redisTemplate.hasKey(getCle(idVoyage, numeroSiege)));
    }

    /**
     * Récupère le temps restant (en secondes) avant libération automatique d'un siège
     * @return temps restant en secondes, -1 si pas de TTL, null si siège non verrouillé
     */
    public Long getTempsRestantVerrou(String idVoyage, int numeroSiege) {
        String cle = getCle(idVoyage, numeroSiege);
        if (Boolean.TRUE.equals(redisTemplate.hasKey(cle))) {
            return redisTemplate.getExpire(cle);
        }
        return null;
    }

    /**
     * Récupère l'occupant d'un siège verrouillé
     * @return idVoyageur ou null si non verrouillé
     */
    public String getOccupantSiege(String idVoyage, int numeroSiege) {
        String cle = getCle(idVoyage, numeroSiege);
        return redisTemplate.opsForValue().get(cle);
    }

    /**
     * Vérifie si l'utilisateur actuel est le propriétaire du verrou
     */
    public boolean estProprietaireVerrou(String idVoyage, int numeroSiege, String idVoyageur) {
        String occupant = getOccupantSiege(idVoyage, numeroSiege);
        return idVoyageur.equals(occupant);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // STATISTIQUES ET MONITORING
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Retourne des statistiques sur les verrous actifs pour un voyage
     */
    public VerrouStats getStatsVerrous(String idVoyage) {
        Set<Integer> verrouilles = getSiegesVerrouilles(idVoyage);
        long totalTtlRestant = 0;
        
        for (int siege : verrouilles) {
            Long ttl = getTempsRestantVerrou(idVoyage, siege);
            if (ttl != null && ttl > 0) {
                totalTtlRestant += ttl;
            }
        }
        
        long moyenneTtl = verrouilles.isEmpty() ? 0 : totalTtlRestant / verrouilles.size();
        
        return new VerrouStats(
            verrouilles.size(),
            moyenneTtl,
            DUREE_VERROU.toSeconds()
        );
    }

    /**
     * Classe interne pour les statistiques
     */
    public record VerrouStats(int nombreVerrous, long moyenneTtlSecondes, long ttlMaximumSecondes) {}

    // ─────────────────────────────────────────────────────────────────────────
    // COMPATIBILITÉ — ancienne API ReservationLockManager
    //
    // Conservée pour éviter de casser les appels existants dans ReservationService
    // pendant la transition. Sera supprimée dans une prochaine itération.
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @deprecated Utiliser acquerirVerrouSieges() à la place.
     */
    @Deprecated
    public void libererVerrou(String idVoyage, String idVoyageur) {
        // No-op : les verrous sont désormais gérés par siège, pas par voyageur.
        // Cette méthode est conservée pour la compatibilité de la période de transition.
        log.debug("[SEAT-LOCK] libererVerrou() appelé (no-op — migration vers verrous par siège)");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // HELPER
    // ─────────────────────────────────────────────────────────────────────────

    private String getCle(String idVoyage, int numeroSiege) {
        return String.format(KEY_TEMPLATE, idVoyage, numeroSiege);
    }
}
