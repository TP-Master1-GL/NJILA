package com.njila.njila_booking_service.service;

import com.njila.njila_booking_service.domain.entity.CompteurFidelite;
import com.njila.njila_booking_service.repository.CompteurFideliteRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import java.time.LocalDate;
import java.util.Optional;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class FideliteServiceTest {

    @Mock
    private CompteurFideliteRepository compteurRepository;

    @Mock
    private RedisTemplate<String, String> redisTemplate;

    @Mock
    private ValueOperations<String, String> valueOperations;

    @Mock
    private RabbitTemplate rabbitTemplate;

    @InjectMocks
    private FideliteService fideliteService;

    private final int annee = LocalDate.now().getYear();

    @BeforeEach
    void setUp() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
    }

    @Test
    void incrementer_premierVoyage_compteurA1() {
        when(compteurRepository.findByIdVoyageurAndCodeAgenceAndAnnee(
                1L, "GEN", annee))
                .thenReturn(Optional.empty());
        when(compteurRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        fideliteService.incrementer(1L, "GEN");

        ArgumentCaptor<CompteurFidelite> captor =
                ArgumentCaptor.forClass(CompteurFidelite.class);
        verify(compteurRepository).save(captor.capture());
        assertThat(captor.getValue().getNombreVoyages()).isEqualTo(1);
    }

    @Test
    void incrementer_compteurExistant_incremente() {
        CompteurFidelite existant = CompteurFidelite.builder()
                .idVoyageur(1L).codeAgence("GEN").annee(annee)
                .nombreVoyages(5).voyagesGratuitsUtilises(0).build();
        when(compteurRepository.findByIdVoyageurAndCodeAgenceAndAnnee(
                1L, "GEN", annee))
                .thenReturn(Optional.of(existant));
        when(compteurRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        fideliteService.incrementer(1L, "GEN");

        assertThat(existant.getNombreVoyages()).isEqualTo(6);
    }

    @Test
    void incrementer_10eVoyage_publieNotificationRabbitMQ() {
        CompteurFidelite existant = CompteurFidelite.builder()
                .idVoyageur(1L).codeAgence("GEN").annee(annee)
                .nombreVoyages(9).voyagesGratuitsUtilises(0).build();
        when(compteurRepository.findByIdVoyageurAndCodeAgenceAndAnnee(
                1L, "GEN", annee))
                .thenReturn(Optional.of(existant));
        when(compteurRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        fideliteService.incrementer(1L, "GEN");

        verify(rabbitTemplate).convertAndSend(
                eq("njila.booking.exchange"),
                eq("booking.fidelite.reward"),
                any(Object.class));
    }

    @Test
    void incrementer_20eVoyage_publieNotificationRabbitMQ() {
        CompteurFidelite existant = CompteurFidelite.builder()
                .idVoyageur(1L).codeAgence("GEN").annee(annee)
                .nombreVoyages(19).voyagesGratuitsUtilises(0).build();
        when(compteurRepository.findByIdVoyageurAndCodeAgenceAndAnnee(
                1L, "GEN", annee))
                .thenReturn(Optional.of(existant));
        when(compteurRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        fideliteService.incrementer(1L, "GEN");

        verify(rabbitTemplate).convertAndSend(
                eq("njila.booking.exchange"),
                eq("booking.fidelite.reward"),
                any(Object.class));
    }

    @Test
    void incrementer_5eVoyage_pasDNotification() {
        CompteurFidelite existant = CompteurFidelite.builder()
                .idVoyageur(1L).codeAgence("GEN").annee(annee)
                .nombreVoyages(4).voyagesGratuitsUtilises(0).build();
        when(compteurRepository.findByIdVoyageurAndCodeAgenceAndAnnee(
                1L, "GEN", annee))
                .thenReturn(Optional.of(existant));
        when(compteurRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        fideliteService.incrementer(1L, "GEN");

        verify(rabbitTemplate, never()).convertAndSend(
                anyString(), anyString(), any(Object.class));
    }

    @Test
    void estVoyageGratuit_depuisRedis_10Voyages_retourneTrue() {
        when(valueOperations.get(anyString())).thenReturn("10");
        assertThat(fideliteService.estVoyageGratuit(1L, "GEN")).isTrue();
    }

    @Test
    void estVoyageGratuit_depuisRedis_5Voyages_retourneFalse() {
        when(valueOperations.get(anyString())).thenReturn("5");
        assertThat(fideliteService.estVoyageGratuit(1L, "GEN")).isFalse();
    }

    @Test
    void estVoyageGratuit_cacheMiss_lireEnBase() {
        when(valueOperations.get(anyString())).thenReturn(null);
        when(compteurRepository.findByIdVoyageurAndCodeAgenceAndAnnee(
                1L, "GEN", annee))
                .thenReturn(Optional.of(CompteurFidelite.builder()
                        .nombreVoyages(10).build()));

        assertThat(fideliteService.estVoyageGratuit(1L, "GEN")).isTrue();
    }

    @Test
    void estVoyageGratuit_aucunCompteur_retourneFalse() {
        when(valueOperations.get(anyString())).thenReturn(null);
        when(compteurRepository.findByIdVoyageurAndCodeAgenceAndAnnee(
                any(), any(), any()))
                .thenReturn(Optional.empty());

        assertThat(fideliteService.estVoyageGratuit(1L, "GEN")).isFalse();
    }

    @Test
    void getNombreVoyages_depuisRedis() {
        when(valueOperations.get(anyString())).thenReturn("7");
        assertThat(fideliteService.getNombreVoyages(1L, "GEN")).isEqualTo(7);
    }

    @Test
    void getNombreVoyages_cacheMiss_depuisBase() {
        when(valueOperations.get(anyString())).thenReturn(null);
        when(compteurRepository.findByIdVoyageurAndCodeAgenceAndAnnee(
                1L, "GEN", annee))
                .thenReturn(Optional.of(CompteurFidelite.builder()
                        .nombreVoyages(3).build()));

        assertThat(fideliteService.getNombreVoyages(1L, "GEN")).isEqualTo(3);
    }
}