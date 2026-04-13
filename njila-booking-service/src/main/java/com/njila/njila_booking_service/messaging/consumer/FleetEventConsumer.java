package com.njila.njila_booking_service.messaging.consumer;

import com.njila.njila_booking_service.config.RabbitMQConfig;
import com.njila.njila_booking_service.domain.entity.projection.VoyageData;
import com.njila.njila_booking_service.domain.entity.projection.AgenceData;
import com.njila.njila_booking_service.domain.entity.projection.FilialeData;
import com.njila.njila_booking_service.repository.projection.VoyageDataRepository;
import com.njila.njila_booking_service.repository.projection.AgenceDataRepository;
import com.njila.njila_booking_service.repository.projection.FilialeDataRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class FleetEventConsumer {

    private final VoyageDataRepository voyageRepository;
    private final AgenceDataRepository agenceRepository;
    private final FilialeDataRepository filialeRepository;

    @RabbitListener(queues = RabbitMQConfig.FLEET_SYNC_QUEUE)
    public void consumeFleetEvent(Map<String, Object> event) {
        String type = (String) event.get("type");
        log.info("[FLEET-SYNC] Événement reçu type={}", type);

        switch (type) {
            case "JOURNEY_CREATED", "JOURNEY_UPDATED" -> handleJourneyEvent(event);
            case "AGENCY_CREATED", "AGENCY_UPDATED"   -> handleAgencyEvent(event);
            case "SUBSIDIARY_CREATED", "SUBSIDIARY_UPDATED" -> handleSubsidiaryEvent(event);
            default -> log.warn("[FLEET-SYNC] Type d'événement inconnu : {}", type);
        }
    }

    private void handleJourneyEvent(Map<String, Object> event) {
        Map<String, Object> data = (Map<String, Object>) event.get("data");
        VoyageData voyage = VoyageData.builder()
                .id(Long.valueOf(data.get("id").toString()))
                .origine(data.get("origine").toString())
                .destination(data.get("destination").toString())
                .dateHeureDepart(LocalDateTime.parse(data.get("dateHeureDepart").toString()))
                .prix(Double.valueOf(data.get("prix").toString()))
                .placesDisponibles(Integer.valueOf(data.get("placesDisponibles").toString()))
                .immatriculationBus(data.get("immatriculationBus").toString())
                .codeAgence(data.get("codeAgence").toString())
                .codeFiliale(data.get("codeFiliale").toString())
                .build();
        voyageRepository.save(voyage);
        log.info("[FLEET-SYNC] Voyage synchronisé ID={}", voyage.getId());
    }

    private void handleAgencyEvent(Map<String, Object> event) {
        Map<String, Object> data = (Map<String, Object>) event.get("data");
        AgenceData agence = AgenceData.builder()
                .code(data.get("code").toString())
                .nom(data.get("nom").toString())
                .ville(data.get("ville").toString())
                .logoUrl(data.get("logoUrl") != null ? data.get("logoUrl").toString() : null)
                .build();
        agenceRepository.save(agence);
        log.info("[FLEET-SYNC] Agence synchronisée Code={}", agence.getCode());
    }

    private void handleSubsidiaryEvent(Map<String, Object> event) {
        Map<String, Object> data = (Map<String, Object>) event.get("data");
        FilialeData filiale = FilialeData.builder()
                .code(data.get("code").toString())
                .nom(data.get("nom").toString())
                .pays(data.get("pays").toString())
                .build();
        filialeRepository.save(filiale);
        log.info("[FLEET-SYNC] Filiale synchronisée Code={}", filiale.getCode());
    }
}
