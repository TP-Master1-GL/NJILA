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
        String id = data.getOrDefault("Id_voyage", data.getOrDefault("id", "")).toString();
        
        VoyageData voyage = VoyageData.builder()
                .id(id)
                .origine(data.getOrDefault("Origine", data.getOrDefault("origine", "")).toString())
                .destination(data.getOrDefault("Destination", data.getOrDefault("destination", "")).toString())
                .dateHeureDepart(LocalDateTime.parse(data.get("DateHeureDepart") != null ? data.get("DateHeureDepart").toString() : data.get("dateHeureDepart").toString()))
                .prix(Double.valueOf(data.getOrDefault("Prix", data.getOrDefault("prix", "0.0")).toString()))
                .placesDisponibles(Integer.valueOf(data.getOrDefault("PlacesDisponibles", data.getOrDefault("placesDisponibles", "0")).toString()))
                .immatriculationBus(data.getOrDefault("ImmatriculationBus", data.getOrDefault("immatriculationBus", "")).toString())
                .typeVoyage(data.getOrDefault("TypeVoyage", data.getOrDefault("typeVoyage", "")).toString())
                .status(data.getOrDefault("StatutVoyage", data.getOrDefault("status", "OUVERT")).toString())
                .codeAgence(data.getOrDefault("Id_agence", data.getOrDefault("codeAgence", "")).toString())
                .codeFiliale(data.getOrDefault("Id_filiale", data.getOrDefault("codeFiliale", "")).toString())
                .build();
        voyageRepository.save(voyage);
        log.info("[FLEET-SYNC] Voyage synchronisé ID={}", voyage.getId());
    }

    private void handleAgencyEvent(Map<String, Object> event) {
        Map<String, Object> data = (Map<String, Object>) event.get("data");
        String id = data.getOrDefault("Id_agence", data.getOrDefault("id", data.getOrDefault("code", ""))).toString();
        
        AgenceData agence = AgenceData.builder()
                .id(id)
                .nom(data.getOrDefault("Nom", data.getOrDefault("nom", "")).toString())
                .adresse(data.getOrDefault("Adresse", data.getOrDefault("adresse", "")).toString())
                .telephone(data.getOrDefault("Telephone", data.getOrDefault("telephone", "")).toString())
                .emailOfficiel(data.getOrDefault("EmailOfficiel", data.getOrDefault("emailOfficiel", "")).toString())
                .statutGlobal(data.getOrDefault("StatutGlobal", data.getOrDefault("statutGlobal", "ACTIF")).toString())
                .logoUrl(data.get("logoUrl") != null ? data.get("logoUrl").toString() : (data.get("LogoUrl") != null ? data.get("LogoUrl").toString() : null))
                .build();
        agenceRepository.save(agence);
        log.info("[FLEET-SYNC] Agence synchronisée ID={}", agence.getId());
    }

    private void handleSubsidiaryEvent(Map<String, Object> event) {
        Map<String, Object> data = (Map<String, Object>) event.get("data");
        String id = data.getOrDefault("Id_filiale", data.getOrDefault("id", data.getOrDefault("code", ""))).toString();
        
        FilialeData filiale = FilialeData.builder()
                .id(id)
                .agenceId(data.getOrDefault("Id_agence", "").toString())
                .nom(data.getOrDefault("Nom", data.getOrDefault("nom", "")).toString())
                .code(data.getOrDefault("Code", data.getOrDefault("code", "")).toString())
                .ville(data.getOrDefault("Ville", data.getOrDefault("ville", "")).toString())
                .adresse(data.getOrDefault("Adresse", data.getOrDefault("adresse", "")).toString())
                .telephone(data.getOrDefault("Telephone", "").toString())
                .email(data.getOrDefault("Email", "").toString())
                .build();
        filialeRepository.save(filiale);
        log.info("[FLEET-SYNC] Filiale synchronisée ID={}", filiale.getId());
    }
}
