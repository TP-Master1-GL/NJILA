package com.njila.njila_booking_service.client;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

/**
 * Client REST vers le fleet-service.
 *
 * Correction : toutes les exceptions réseau (ResourceAccessException)
 * sont interceptées et converties en ServiceIndisponibleException afin
 * d'être traitées uniformément par le GlobalExceptionHandler (HTTP 503).
 */
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
        try {
            return restTemplate.getForObject(url, Map.class);
        } catch (ResourceAccessException ex) {
            log.error("[FLEET] fleet-service indisponible pour GET voyage={} : {}",
                    idVoyage, ex.getMessage());
            throw new ServiceIndisponibleException(
                    "fleet-service indisponible : impossible de récupérer le voyage "
                    + idVoyage, ex);
        }
    }

    public boolean verifierDisponibilite(Long idVoyage, int nombrePlaces) {
        String url = fleetServiceUrl + "/api/fleet/voyages/" + idVoyage
                + "/disponibilite?places=" + nombrePlaces;
        log.info("[FLEET] Vérification disponibilité voyage={} places={}",
                idVoyage, nombrePlaces);
        try {
            Boolean disponible = restTemplate.getForObject(url, Boolean.class);
            return Boolean.TRUE.equals(disponible);
        } catch (ResourceAccessException ex) {
            log.error("[FLEET] fleet-service indisponible pour disponibilité voyage={} : {}",
                    idVoyage, ex.getMessage());
            throw new ServiceIndisponibleException(
                    "fleet-service indisponible : impossible de vérifier la disponibilité "
                    + "du voyage " + idVoyage, ex);
        }
    }

    public Map<String, Object> getFiliale(Long idFiliale) {
        String url = fleetServiceUrl + "/api/fleet/filiales/" + idFiliale;
        log.info("[FLEET] GET filiale : {}", url);
        try {
            return restTemplate.getForObject(url, Map.class);
        } catch (ResourceAccessException ex) {
            log.error("[FLEET] fleet-service indisponible pour GET filiale={} : {}",
                    idFiliale, ex.getMessage());
            throw new ServiceIndisponibleException(
                    "fleet-service indisponible : impossible de récupérer la filiale "
                    + idFiliale, ex);
        }
    }
}