package com.njila.njila_user_service.events.publisher;

import com.njila.njila_user_service.config.RabbitMQConfig;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
@RequiredArgsConstructor
@Slf4j
public class NotificationEventPublisher {

    private final RabbitTemplate rabbitTemplate;

    public void publishStaffCreated(String userId, String email, String role,
                                    String name, String surname, String agenceId,
                                    String filialeId, String createdBy, String createdByName) {
        
        log.info("╔══════════════════════════════════════════════════════════════════╗");
        log.info("║ [NOTIFICATION] PUBLICATION STAFF.CREATED                         ║");
        log.info("╠══════════════════════════════════════════════════════════════════╣");
        log.info("║ userId:        {}                                                ", userId);
        log.info("║ email:         {}                                                ", email);
        log.info("║ role:          {}                                                ", role);
        log.info("║ name:          {} {}                                            ", name, surname);
        log.info("║ agenceId:      {}                                                ", agenceId);
        log.info("║ filialeId:     {}                                                ", filialeId);
        log.info("║ createdBy:     {}                                                ", createdBy);
        log.info("║ createdByName: {}                                                ", createdByName);
        log.info("║ exchange:      {}                                                ", RabbitMQConfig.EXCHANGE_NOTIFICATION);
        log.info("║ routingKey:    staff.created                                     ");
        log.info("╚══════════════════════════════════════════════════════════════════╝");
        
        Map<String, Object> payload = Map.ofEntries(
            Map.entry("userId",         userId),
            Map.entry("email",          email),
            Map.entry("role",           role),
            Map.entry("name",           name          != null ? name          : ""),
            Map.entry("surname",        surname       != null ? surname       : ""),
            Map.entry("agenceId",       agenceId      != null ? agenceId      : ""),
            Map.entry("filialeId",      filialeId     != null ? filialeId     : ""),
            Map.entry("createdBy",      createdBy),
            Map.entry("createdByName",  createdByName != null ? createdByName : ""),
            Map.entry("eventType",      "STAFF_CREATED"),
            Map.entry("timestamp",      java.time.Instant.now().toString())
        );
        
        log.info("[NOTIFICATION] Payload staff.created: {}", payload);
        publish(RabbitMQConfig.EXCHANGE_NOTIFICATION, "staff.created", payload, "Notification staff.created");
    }

    public void publishStaffDeleted(String userId, String email, String role,
                                    String agenceId, String filialeId,
                                    String deletedBy, String deletedByName) {
        
        log.info("╔══════════════════════════════════════════════════════════════════╗");
        log.info("║ [NOTIFICATION] PUBLICATION STAFF.DELETED                         ║");
        log.info("╠══════════════════════════════════════════════════════════════════╣");
        log.info("║ userId:        {}                                                ", userId);
        log.info("║ email:         {}                                                ", email);
        log.info("║ role:          {}                                                ", role);
        log.info("║ agenceId:      {}                                                ", agenceId);
        log.info("║ filialeId:     {}                                                ", filialeId);
        log.info("║ deletedBy:     {}                                                ", deletedBy);
        log.info("║ deletedByName: {}                                                ", deletedByName);
        log.info("║ exchange:      {}                                                ", RabbitMQConfig.EXCHANGE_NOTIFICATION);
        log.info("║ routingKey:    staff.deleted                                     ");
        log.info("╚══════════════════════════════════════════════════════════════════╝");
        
        Map<String, Object> payload = Map.ofEntries(
            Map.entry("userId",        userId),
            Map.entry("email",         email),
            Map.entry("role",          role),
            Map.entry("agenceId",      agenceId      != null ? agenceId      : ""),
            Map.entry("filialeId",     filialeId     != null ? filialeId     : ""),
            Map.entry("deletedBy",     deletedBy),
            Map.entry("deletedByName", deletedByName != null ? deletedByName : ""),
            Map.entry("eventType",     "STAFF_DELETED"),
            Map.entry("timestamp",     java.time.Instant.now().toString())
        );
        
        log.info("[NOTIFICATION] Payload staff.deleted: {}", payload);
        publish(RabbitMQConfig.EXCHANGE_NOTIFICATION, "staff.deleted", payload, "Notification staff.deleted");
    }

    public void publishProfileUpdated(String userId, String email,
                                      String name, String surname, String updatedBy) {
        
        log.info("╔══════════════════════════════════════════════════════════════════╗");
        log.info("║ [NOTIFICATION] PUBLICATION PROFILE.UPDATED                       ║");
        log.info("╠══════════════════════════════════════════════════════════════════╣");
        log.info("║ userId:     {}                                                   ", userId);
        log.info("║ email:      {}                                                   ", email);
        log.info("║ name:       {} {}                                               ", name, surname);
        log.info("║ updatedBy:  {}                                                   ", updatedBy);
        log.info("║ exchange:   {}                                                   ", RabbitMQConfig.EXCHANGE_NOTIFICATION);
        log.info("║ routingKey: profile.updated                                      ");
        log.info("╚══════════════════════════════════════════════════════════════════╝");
        
        Map<String, Object> payload = Map.ofEntries(
            Map.entry("userId",    userId),
            Map.entry("email",     email),
            Map.entry("name",      name    != null ? name    : ""),
            Map.entry("surname",   surname != null ? surname : ""),
            Map.entry("updatedBy", updatedBy),
            Map.entry("eventType", "PROFILE_UPDATED"),
            Map.entry("timestamp", java.time.Instant.now().toString())
        );
        
        log.info("[NOTIFICATION] Payload profile.updated: {}", payload);
        publish(RabbitMQConfig.EXCHANGE_NOTIFICATION, "profile.updated", payload, "Notification profile.updated");
    }

    private void publish(String exchange, String routingKey,
                         Map<String, Object> payload, String label) {
        try {
            log.info("[NOTIFICATION] Tentative d'envoi | exchange={} routingKey={}", exchange, routingKey);
            rabbitTemplate.convertAndSend(exchange, routingKey, payload);
            log.info("[NOTIFICATION] ✅ SUCCÈS | {} | exchange={} routingKey={}", label, exchange, routingKey);
        } catch (Exception e) {
            log.error("[NOTIFICATION] ❌ ERREUR {} : {}", label, e.getMessage(), e);
        }
    }
}