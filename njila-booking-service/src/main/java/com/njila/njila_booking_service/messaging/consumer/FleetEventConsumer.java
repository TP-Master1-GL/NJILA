package com.njila.njila_booking_service.messaging.consumer;

import com.njila.njila_booking_service.config.RabbitMQConfig;
import com.njila.njila_booking_service.domain.entity.projection.AgenceData;
import com.njila.njila_booking_service.domain.entity.projection.BusData;
import com.njila.njila_booking_service.domain.entity.projection.FilialeData;
import com.njila.njila_booking_service.domain.entity.projection.VoyageData;
import com.njila.njila_booking_service.repository.projection.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class FleetEventConsumer {

    private final VoyageDataRepository  voyageRepository;
    private final AgenceDataRepository  agenceRepository;
    private final FilialeDataRepository filialeRepository;
    private final BusDataRepository     busRepository;

    @RabbitListener(queues = {
            RabbitMQConfig.FLEET_AGENCY_QUEUE,
            RabbitMQConfig.FLEET_FILIALE_QUEUE,
            RabbitMQConfig.FLEET_VOYAGE_QUEUE,
            RabbitMQConfig.FLEET_BUS_QUEUE
    })
    public void consumeFleetEvent(Map<String, Object> event) {
        String eventType = (String) event.get("event_type");
        log.info("[FLEET-SYNC] Événement reçu event_type={}", eventType);

        if (eventType == null) {
            log.warn("[FLEET-SYNC] Événement sans event_type, clés reçues: {}", event.keySet());
            return;
        }

        switch (eventType) {
            case "VOYAGE_UPDATED"  -> handleJourneyEvent(event);
            case "AGENCY_UPDATED"  -> handleAgencyEvent(event);
            case "FILIALE_UPDATED" -> handleSubsidiaryEvent(event);
            case "BUS_UPDATED"     -> handleBusEvent(event);
            default -> log.warn("[FLEET-SYNC] Type d'événement inconnu : {}", eventType);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // VOYAGE
    // ─────────────────────────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private void handleJourneyEvent(Map<String, Object> event) {
        String id = (String) event.get("voyage_id");
        if (id == null) {
            log.warn("[FLEET-SYNC] Voyage sans voyage_id, ignoré");
            return;
        }

        Map<String, Object> origine     = (Map<String, Object>) event.get("origine");
        Map<String, Object> destination = (Map<String, Object>) event.get("destination");
        Map<String, Object> bus         = (Map<String, Object>) event.get("bus");

        String origineVille       = origine     != null ? (String) origine.get("ville")      : "";
        String destinationVille   = destination != null ? (String) destination.get("ville")   : "";
        String immatriculationBus = bus         != null ? (String) bus.get("immatriculation") : "";

        // Capacité du bus depuis l'événement voyage (dénormalisée)
        Integer capaciteBus = null;
        if (bus != null && bus.get("capacite") != null) {
            capaciteBus = Integer.valueOf(bus.get("capacite").toString());
        }
        // Fallback : chercher dans BusData si déjà synchronisé
        if (capaciteBus == null && immatriculationBus != null && !immatriculationBus.isBlank()) {
            capaciteBus = busRepository.findByImmatriculation(immatriculationBus)
                    .map(BusData::getCapacite)
                    .orElse(null);
        }

        String status = (String) event.get("status");
        if (status == null) status = "PROGRAMME";

        LocalDateTime dateHeureDepart = null;
        Object dateObj = event.get("date_heure_depart");
        if (dateObj != null) {
            try {
                dateHeureDepart = LocalDateTime.parse(dateObj.toString());
            } catch (Exception e) {
                log.warn("[FLEET-SYNC] Impossible de parser date_heure_depart: {}", dateObj);
            }
        }

        VoyageData voyage = VoyageData.builder()
                .id(id)
                .origine(origineVille)
                .destination(destinationVille)
                .dateHeureDepart(dateHeureDepart)
                .prix(event.get("prix") != null
                        ? Double.valueOf(event.get("prix").toString()) : 0.0)
                .placesDisponibles(event.get("places_disponibles") != null
                        ? Integer.valueOf(event.get("places_disponibles").toString()) : 0)
                .immatriculationBus(immatriculationBus)
                .typeVoyage((String) event.get("type_voyage"))
                .status(status)
                .codeAgence((String) event.get("agence_code"))
                .codeFiliale(origine != null ? (String) origine.get("filiale_code") : "")
                .capaciteBus(capaciteBus)
                .build();

        voyageRepository.save(voyage);
        log.info("[FLEET-SYNC] Voyage synchronisé ID={} origine={} destination={} capacité={}",
                voyage.getId(), origineVille, destinationVille, capaciteBus);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // AGENCE
    // ─────────────────────────────────────────────────────────────────────────

    private void handleAgencyEvent(Map<String, Object> event) {
        String id = (String) event.get("code");
        if (id == null) {
            log.warn("[FLEET-SYNC] Agence sans code, ignoré");
            return;
        }

        AgenceData agence = AgenceData.builder()
                .id(id)
                .nom((String) event.get("name"))
                .adresse((String) event.get("ville"))
                .telephone((String) event.get("telephone"))
                .emailOfficiel((String) event.get("email"))
                .statutGlobal((String) event.get("statut"))
                .logoUrl((String) event.get("logoUrl"))
                .build();

        agenceRepository.save(agence);
        log.info("[FLEET-SYNC] Agence synchronisée ID={}", agence.getId());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // FILIALE
    // ─────────────────────────────────────────────────────────────────────────

    private void handleSubsidiaryEvent(Map<String, Object> event) {
        String id = (String) event.get("code");
        if (id == null) {
            log.warn("[FLEET-SYNC] Filiale sans code, ignoré");
            return;
        }

        FilialeData filiale = FilialeData.builder()
                .id(id)
                .agenceId((String) event.get("agence_code"))
                .nom((String) event.get("name"))
                .code((String) event.get("code"))
                .ville((String) event.get("ville"))
                .adresse((String) event.get("ville"))
                .telephone((String) event.get("telephone"))
                .email((String) event.get("email"))
                .build();

        filialeRepository.save(filiale);
        log.info("[FLEET-SYNC] Filiale synchronisée ID={}", filiale.getId());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // BUS — persisté dans BusData + mise à jour de capaciteBus dans VoyageData
    // ─────────────────────────────────────────────────────────────────────────

    private void handleBusEvent(Map<String, Object> event) {
        Object busIdObj = event.get("bus_id");
        if (busIdObj == null) {
            log.warn("[FLEET-SYNC] BUS_UPDATED sans bus_id, ignoré");
            return;
        }

        String busId           = busIdObj.toString();
        String immatriculation = (String) event.get("immatriculation");
        String agenceCode      = (String) event.get("agence_code");
        String modele          = (String) event.get("modele");
        String etat            = (String) event.get("etat");

        Integer capacite = null;
        if (event.get("capacite") != null) {
            capacite = Integer.valueOf(event.get("capacite").toString());
        }

        if (immatriculation == null) {
            log.warn("[FLEET-SYNC] BUS_UPDATED sans immatriculation, bus_id={} ignoré", busId);
            return;
        }

        // ── 1. Persister / mettre à jour BusData ──────────────────────────────
        BusData busData = BusData.builder()
                .id(busId)
                .immatriculation(immatriculation)
                .modele(modele)
                .capacite(capacite != null ? capacite : 50)  // défaut 50 si absent
                .etat(etat != null ? etat : "DISPONIBLE")
                .codeAgence(agenceCode)
                .build();
        busRepository.save(busData);
        log.info("[FLEET-SYNC] BusData synchronisé bus_id={} immat={} capacité={} état={}",
                busId, immatriculation, busData.getCapacite(), etat);

        // ── 2. Propager la capacité et l'immatriculation dans VoyageData ──────
        // Filtre en mémoire (≤100 sièges par bus → nombre de voyages limité)
        List<VoyageData> voyagesConcernes = voyageRepository.findAll()
                .stream()
                .filter(v -> immatriculation.equals(v.getImmatriculationBus()))
                .collect(Collectors.toList());

        if (!voyagesConcernes.isEmpty()) {
            final Integer cap = busData.getCapacite();
            voyagesConcernes.forEach(v -> {
                v.setImmatriculationBus(immatriculation);
                v.setCapaciteBus(cap);
            });
            voyageRepository.saveAll(voyagesConcernes);
            log.info("[FLEET-SYNC] {} voyage(s) mis à jour avec capacité={} pour bus {}",
                    voyagesConcernes.size(), cap, immatriculation);
        }
    }
}
