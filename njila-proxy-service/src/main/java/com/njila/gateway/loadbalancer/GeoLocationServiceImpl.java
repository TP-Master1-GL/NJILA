package com.njila.gateway.loadbalancer;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Map;

/**
 * Service de géolocalisation pour le Cameroun.
 *
 * Stratégie :
 *   1. Table statique pour les IPs locales et de test
 *   2. Mapping par plages IP des principaux FAI camerounais (Camtel, MTN, Orange)
 *   3. Fallback : null → score neutre (0.5) sera appliqué par NJANGA
 *
 * EN PRODUCTION : intégrer MaxMind GeoIP2 pour une résolution précise.
 * Dépendance Maven :
 *   <dependency>
 *     <groupId>com.maxmind.geoip2</groupId>
 *     <artifactId>geoip2</artifactId>
 *     <version>4.2.0</version>
 *   </dependency>
 */
@Slf4j
@Service
public class GeoLocationServiceImpl implements GeoLocationService {

    // ─── Table statique pour dev/test et IPs connues ───────────────
    private static final Map<String, String> IP_REGION_MAP = Map.ofEntries(
        // Loopback / développement
        Map.entry("127.0.0.1",    "Douala"),
        Map.entry("::1",          "Douala"),
        Map.entry("0:0:0:0:0:0:0:1", "Douala"),

        // ─── Plages IP Cameroun (exemples représentatifs) ──────────
        // Douala (Littoral)
        Map.entry("41.204.160",   "Douala"),
        Map.entry("41.204.161",   "Douala"),
        Map.entry("197.159.0",    "Douala"),
        Map.entry("154.72.160",   "Douala"),

        // Yaoundé (Centre)
        Map.entry("41.204.162",   "Yaounde"),
        Map.entry("41.204.163",   "Yaounde"),
        Map.entry("197.159.2",    "Yaounde"),
        Map.entry("154.72.162",   "Yaounde"),

        // Bafoussam (Ouest)
        Map.entry("41.204.164",   "Bafoussam"),
        Map.entry("197.159.4",    "Bafoussam"),

        // Bamenda (Nord-Ouest)
        Map.entry("41.204.165",   "Bamenda"),
        Map.entry("197.159.5",    "Bamenda"),

        // Garoua (Nord)
        Map.entry("41.204.166",   "Garoua"),
        Map.entry("197.159.6",    "Garoua"),

        // Maroua (Extrême-Nord)
        Map.entry("41.204.167",   "Maroua"),
        Map.entry("197.159.7",    "Maroua"),

        // Ngaoundéré (Adamaoua)
        Map.entry("41.204.168",   "Ngaoundere"),
        Map.entry("197.159.8",    "Ngaoundere"),

        // Bertoua (Est)
        Map.entry("41.204.169",   "Bertoua"),
        Map.entry("197.159.9",    "Bertoua"),

        // Ebolowa (Sud)
        Map.entry("41.204.170",   "Ebolowa"),
        Map.entry("197.159.10",   "Ebolowa"),

        // Buea (Sud-Ouest)
        Map.entry("41.204.171",   "Buea"),
        Map.entry("197.159.11",   "Buea"),

        // Limbe (Sud-Ouest)
        Map.entry("41.204.172",   "Limbe"),

        // Kribi (Sud)
        Map.entry("41.204.173",   "Kribi"),

        // Kumba (Sud-Ouest)
        Map.entry("41.204.174",   "Kumba")
    );

    @Override
    public String getRegion(String ip) {
        if (ip == null || ip.isBlank()) return null;

        // 1. Recherche exacte
        String region = IP_REGION_MAP.get(ip);
        if (region != null) return region;

        // 2. Recherche par préfixe (3 premiers octets pour IPv4)
        String prefix = extractPrefix(ip);
        if (prefix != null) {
            region = IP_REGION_MAP.get(prefix);
            if (region != null) return region;
        }

        // 3. Heuristique basée sur les plages IP camerounaises connues
        region = resolveByKnownRanges(ip);
        if (region != null) return region;

        log.debug("Region non determinee pour IP={} - score geo neutre (0.5)", ip);
        return null;
    }

    /**
     * Extrait le préfixe réseau (3 premiers octets) d'une IPv4.
     */
    private String extractPrefix(String ip) {
        if (ip.contains(":")) return null; // IPv6
        String[] parts = ip.split("\\.");
        if (parts.length >= 3) {
            return parts[0] + "." + parts[1] + "." + parts[2];
        }
        return null;
    }

    /**
     * Résolution heuristique par plages IP des FAI camerounais.
     * Plages principales :
     *   - Camtel       : 41.204.128.0/17
     *   - MTN Cameroon : 41.202.192.0/18, 154.72.0.0/16
     *   - Orange CM    : 197.159.0.0/16
     */
    private String resolveByKnownRanges(String ip) {
        if (ip.contains(":")) return null;

        String[] parts = ip.split("\\.");
        if (parts.length != 4) return null;

        try {
            int octet1 = Integer.parseInt(parts[0]);
            int octet2 = Integer.parseInt(parts[1]);
            int octet3 = Integer.parseInt(parts[2]);

            // Plage Camtel : 41.204.x.x
            if (octet1 == 41 && octet2 == 204) {
                return resolveFromOctet3(octet3);
            }

            // Plage MTN : 154.72.x.x
            if (octet1 == 154 && octet2 == 72) {
                return resolveFromOctet3(octet3);
            }

            // Plage Orange : 197.159.x.x
            if (octet1 == 197 && octet2 == 159) {
                return resolveFromOctet3(octet3);
            }

            // MTN secondaire : 41.202.192-255
            if (octet1 == 41 && octet2 == 202 && octet3 >= 192) {
                return "Douala";
            }

        } catch (NumberFormatException e) {
            return null;
        }

        return null;
    }

    /**
     * Mapping du 3ème octet vers les 10 régions du Cameroun.
     *   0-25   → Douala (Littoral)
     *   26-50  → Yaoundé (Centre)
     *   51-75  → Bafoussam (Ouest)
     *   76-100 → Bamenda (Nord-Ouest)
     *   101-125 → Garoua (Nord)
     *   126-150 → Maroua (Extrême-Nord)
     *   151-175 → Ngaoundéré (Adamaoua)
     *   176-200 → Bertoua (Est)
     *   201-225 → Ebolowa (Sud)
     *   226-255 → Buea (Sud-Ouest)
     */
    private String resolveFromOctet3(int octet3) {
        if (octet3 <= 25)  return "Douala";
        if (octet3 <= 50)  return "Yaounde";
        if (octet3 <= 75)  return "Bafoussam";
        if (octet3 <= 100) return "Bamenda";
        if (octet3 <= 125) return "Garoua";
        if (octet3 <= 150) return "Maroua";
        if (octet3 <= 175) return "Ngaoundere";
        if (octet3 <= 200) return "Bertoua";
        if (octet3 <= 225) return "Ebolowa";
        return "Buea";
    }
}
