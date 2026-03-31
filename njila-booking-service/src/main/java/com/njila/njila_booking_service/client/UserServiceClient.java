package com.njila.njila_booking_service.client;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

/**
 * Client REST vers le user-service.
 *
 * Correction : toutes les exceptions réseau (ResourceAccessException)
 * sont interceptées et converties en ServiceIndisponibleException.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class UserServiceClient {

    private final RestTemplate restTemplate;

    @Value("${njila.user-service.url:http://localhost:8082}")
    private String userServiceUrl;

    public Map<String, Object> getVoyageur(Long idVoyageur) {
        String url = userServiceUrl + "/api/users/" + idVoyageur;
        log.info("[USER] GET voyageur : {}", url);
        try {
            return restTemplate.getForObject(url, Map.class);
        } catch (ResourceAccessException ex) {
            log.error("[USER] user-service indisponible pour GET voyageur={} : {}",
                    idVoyageur, ex.getMessage());
            throw new ServiceIndisponibleException(
                    "user-service indisponible : impossible de récupérer le voyageur "
                    + idVoyageur, ex);
        }
    }
}