package com.njila.njila_booking_service.client;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;
import java.util.Map;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class FleetServiceClientTest {

    @Mock
    private RestTemplate restTemplate;

    @InjectMocks
    private FleetServiceClient fleetClient;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(
                fleetClient, "fleetServiceUrl", "http://localhost:8088");
    }

    @Test
    void getVoyage_succes_retourneMap() {
        Map<String, Object> mock = Map.of("id", 1, "prix", 5000.0);
        when(restTemplate.getForObject(
                "http://localhost:8088/api/fleet/voyages/1", Map.class))
                .thenReturn(mock);

        Map<String, Object> result = fleetClient.getVoyage(1L);

        assertThat(result).isNotNull();
        assertThat(result.get("prix")).isEqualTo(5000.0);
    }

    @Test
    void getVoyage_serviceIndisponible_leveServiceIndisponibleException() {
        // Le ResourceAccessException doit être intercepté dans FleetServiceClient
        // et converti en ServiceIndisponibleException
        when(restTemplate.getForObject(
                eq("http://localhost:8088/api/fleet/voyages/1"),
                eq(Map.class)))
                .thenThrow(new ResourceAccessException("Connexion refusée"));

        assertThatThrownBy(() -> fleetClient.getVoyage(1L))
                .isInstanceOf(ServiceIndisponibleException.class)
                .hasMessageContaining("fleet-service indisponible");
    }

    @Test
    void verifierDisponibilite_disponible_retourneTrue() {
        when(restTemplate.getForObject(
                "http://localhost:8088/api/fleet/voyages/1/disponibilite?places=2",
                Boolean.class))
                .thenReturn(true);

        assertThat(fleetClient.verifierDisponibilite(1L, 2)).isTrue();
    }

    @Test
    void verifierDisponibilite_nonDisponible_retourneFalse() {
        when(restTemplate.getForObject(
                "http://localhost:8088/api/fleet/voyages/1/disponibilite?places=10",
                Boolean.class))
                .thenReturn(false);

        assertThat(fleetClient.verifierDisponibilite(1L, 10)).isFalse();
    }

    @Test
    void verifierDisponibilite_serviceIndisponible_leveException() {
        when(restTemplate.getForObject(
                anyString(),
                eq(Boolean.class)))
                .thenThrow(new ResourceAccessException("Connexion refusée"));

        assertThatThrownBy(() -> fleetClient.verifierDisponibilite(1L, 1))
                .isInstanceOf(ServiceIndisponibleException.class)
                .hasMessageContaining("fleet-service indisponible");
    }

    @Test
    void getFiliale_succes_retourneMap() {
        Map<String, Object> mock = Map.of("id", 1, "code", "BYDE");
        when(restTemplate.getForObject(
                "http://localhost:8088/api/fleet/filiales/1", Map.class))
                .thenReturn(mock);

        Map<String, Object> result = fleetClient.getFiliale(1L);
        assertThat(result.get("code")).isEqualTo("BYDE");
    }
}
