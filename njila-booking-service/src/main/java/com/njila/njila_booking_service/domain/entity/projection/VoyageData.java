package com.njila.njila_booking_service.domain.entity.projection;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * Projection locale du voyage synchronisée depuis fleet-service via RabbitMQ.
 *
 * Changement : ajout de {@code capaciteBus} (dénormalisé depuis l'événement BUS_UPDATED
 * ou VOYAGE_UPDATED) pour éviter une jointure avec BusData à chaque réservation.
 */
@Entity
@Table(name = "voyages_projection")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class VoyageData {

    @Id
    private String id;

    private String origine;
    private String destination;
    private LocalDateTime dateHeureDepart;
    private Double prix;
    private Integer placesDisponibles;
    private String immatriculationBus;
    private String typeVoyage;
    private String status;
    private String codeAgence;
    private String codeFiliale;

    /**
     * Capacité totale du bus (nombre de sièges).
     * Dénormalisé depuis BusData lors de la synchronisation fleet.
     * Nullable : si null, ReservationService se replie sur BusDataRepository.
     */
    private Integer capaciteBus;
}
