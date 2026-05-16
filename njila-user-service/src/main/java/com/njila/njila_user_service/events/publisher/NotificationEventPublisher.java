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
        
        log.info("[NOTIFICATION] staff.created | userId={} role={} email={}", userId, role, email);
        
        Map<String, Object> payload = Map.ofEntries(
            Map.entry("userId", userId),
            Map.entry("email", email),
            Map.entry("role", role),
            Map.entry("name", name != null ? name : ""),
            Map.entry("surname", surname != null ? surname : ""),
            Map.entry("agenceNom", agenceId != null ? agenceId : ""),
            Map.entry("filialeId", filialeId != null ? filialeId : ""),
            Map.entry("createdBy", createdBy),
            Map.entry("createdByName", createdByName != null ? createdByName : ""),
            Map.entry("eventType", "STAFF_CREATED"),
            Map.entry("timestamp", java.time.Instant.now().toString())
        );
        
        publish(RabbitMQConfig.EXCHANGE_NOTIFICATION, "staff.created", payload);
    }

    public void publishStaffDeleted(String userId, String email, String role,
                                    String agenceId, String filialeId,
                                    String deletedBy, String deletedByName) {
        
        log.info("[NOTIFICATION] staff.deleted | userId={} role={} email={}", userId, role, email);
        
        Map<String, Object> payload = Map.ofEntries(
            Map.entry("userId", userId),
            Map.entry("email", email),
            Map.entry("role", role),
            Map.entry("agenceNom", agenceId != null ? agenceId : ""),
            Map.entry("filialeNom", filialeId != null ? filialeId : ""),
            Map.entry("deletedBy", deletedBy),
            Map.entry("deletedByName", deletedByName != null ? deletedByName : ""),
            Map.entry("eventType", "STAFF_DELETED"),
            Map.entry("timestamp", java.time.Instant.now().toString())
        );
        
        publish(RabbitMQConfig.EXCHANGE_NOTIFICATION, "staff.deleted", payload);
    }

    public void publishProfileUpdated(String userId, String email,
                                      String name, String surname, String updatedBy) {
        
        log.info("[NOTIFICATION] profile.updated | userId={} email={}", userId, email);
        
        Map<String, Object> payload = Map.ofEntries(
            Map.entry("userId", userId),
            Map.entry("email", email),
            Map.entry("name", name != null ? name : ""),
            Map.entry("surname", surname != null ? surname : ""),
            Map.entry("updatedBy", updatedBy),
            Map.entry("eventType", "PROFILE_UPDATED"),
            Map.entry("timestamp", java.time.Instant.now().toString())
        );
        
        publish(RabbitMQConfig.EXCHANGE_NOTIFICATION, "profile.updated", payload);
    }

    private void publish(String exchange, String routingKey, Map<String, Object> payload) {
        try {
            rabbitTemplate.convertAndSend(exchange, routingKey, payload);
            log.info("[NOTIFICATION] Sent | exchange={} key={}", exchange, routingKey);
        } catch (Exception e) {
            log.error("[NOTIFICATION] Failed: {}", e.getMessage());
        }
    }
}
