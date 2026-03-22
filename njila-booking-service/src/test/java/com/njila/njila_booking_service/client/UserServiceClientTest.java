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
class UserServiceClientTest {

    @Mock
    private RestTemplate restTemplate;

    @InjectMocks
    private UserServiceClient userClient;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(
                userClient, "userServiceUrl", "http://localhost:8082");
    }

    @Test
    void getVoyageur_succes_retourneMap() {
        Map<String, Object> mock = Map.of(
                "id",      1,
                "nom",     "NGUEMBU",
                "surname", "John",
                "email",   "john@njila.cm",
                "phone",   "+237699000001"
        );
        when(restTemplate.getForObject(
                "http://localhost:8082/api/users/1", Map.class))
                .thenReturn(mock);

        Map<String, Object> result = userClient.getVoyageur(1L);

        assertThat(result).isNotNull();
        assertThat(result.get("nom")).isEqualTo("NGUEMBU");
        assertThat(result.get("email")).isEqualTo("john@njila.cm");
    }

    @Test
    void getVoyageur_serviceIndisponible_leveServiceIndisponibleException() {
        when(restTemplate.getForObject(
                eq("http://localhost:8082/api/users/1"),
                eq(Map.class)))
                .thenThrow(new ResourceAccessException("Connexion refusée"));

        assertThatThrownBy(() -> userClient.getVoyageur(1L))
                .isInstanceOf(ServiceIndisponibleException.class)
                .hasMessageContaining("user-service indisponible");
    }

    @Test
    void getVoyageur_urlCorrecteAppele() {
        when(restTemplate.getForObject(
                "http://localhost:8082/api/users/5", Map.class))
                .thenReturn(Map.of("id", 5));

        userClient.getVoyageur(5L);

        verify(restTemplate).getForObject(
                "http://localhost:8082/api/users/5", Map.class);
    }
}
