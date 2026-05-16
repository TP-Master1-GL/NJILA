package com.njila.njila_booking_service.domain.entity.projection;

import jakarta.persistence.*;
import lombok.*;

/**
 * Projection locale du bus synchronisée depuis fleet-service via RabbitMQ.
 * Stocke uniquement les données utiles au booking :
 *  - capacité totale (nombre de sièges)
 *  - état du bus (pour refuser la réservation si EN_PANNE/MAINTENANCE)
 *  - immatriculation (clé de jointure avec VoyageData)
 */
@Entity
@Table(name = "bus_projection")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BusData {

    /** Identifiant interne fleet-service (IdBus AutoField → stocké en String) */
    @Id
    private String id;

    /** Immatriculation — clé métier utilisée dans VoyageData */
    @Column(nullable = false, unique = true)
    private String immatriculation;

    /** Modèle du bus (ex: "Mercedes Sprinter") */
    private String modele;

    /** Nombre total de sièges passagers */
    @Column(nullable = false)
    private Integer capacite;

    /**
     * État du bus : DISPONIBLE | EN_PANNE | EN_VOYAGE | MAINTENANCE | RESERVE.
     * Copié tel quel depuis fleet-service.
     */
    @Column(nullable = false)
    private String etat;

    /** Code de l'agence propriétaire */
    private String codeAgence;
}
