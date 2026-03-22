package com.njila.njila_booking_service.client;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;
import java.util.Map;

@Component
@RequiredArgsConstructor
@Slf4j
public class FleetServiceClient {

    private final RestTemplate restTemplate;

    @Value("${njila.fleet-service.url:http://localhost:8088}")
    private String fleetServiceUrl;

    public Map<String, Object> getVoyage(Long idVoyage) {
        String url = fleetServiceUrl + "/api/fleet/voyages/" + idVoyage;
        log.info("[FLEET] GET voyage : {}", url);
        return restTemplate.getForObject(url, Map.class);
    }

    public boolean verifierDisponibilite(Long idVoyage, int nombrePlaces) {
        String url = fleetServiceUrl + "/api/fleet/voyages/" + idVoyage
        + "/disponibilite?places=" + nombrePlaces;
        log.info("[FLEET] Vérification disponibilité voyage={} places={}", idVoyage, nombrePlaces);
        Boolean disponible = restTemplate.getForObject(url, Boolean.class);
        return Boolean.TRUE.equals(disponible);
    }

    public Map<String, Object> getFiliale(Long idFiliale) {
        String url = fleetServiceUrl + "/api/fleet/filiales/" + idFiliale;
        return restTemplate.getForObject(url, Map.class);
    }
}