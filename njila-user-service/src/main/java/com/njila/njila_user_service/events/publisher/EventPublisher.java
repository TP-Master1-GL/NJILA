package com.njila.njila_user_service.events.publisher;

import com.njila.njila_user_service.config.RabbitMQConfig;
import com.njila.njila_user_service.observer.IUserObserver;
import com.njila.njila_user_service.observer.UserEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.UUID;


@Component
@RequiredArgsConstructor
@Slf4j
public class EventPublisher implements IUserObserver {

    private final RabbitTemplate rabbitTemplate;

    @Override
    public void onUserEvent(UserEvent event) {
        switch (event.getEventType()) {
            case PROFIL_MODIFIER   -> publishProfileUpdated(event);
            case PHOTO_MISE_A_JOUR -> publishPhotoUpdated(event);
            case COMPTE_CREE       -> publishProfileCreated(event);
            case COMPTE_SUPPRIMER  -> publishStaffDeleted(event);
            case STAFF_CREE        -> publishStaffCreated(event);
            default -> log.debug("[PUBLISHER] Événement ignoré : {}", event.getEventType());
        }
    }

    public void publishProfileCreated(UserEvent event) {
        publish(RabbitMQConfig.EXCHANGE_USER, RabbitMQConfig.KEY_PROFILE_CREATED,
                event.getPayload(), "profile.created");
    }

    public void publishProfileUpdated(UserEvent event) {
        publish(RabbitMQConfig.EXCHANGE_NOTIFICATION, RabbitMQConfig.KEY_PROFILE_UPDATED,
                event.getPayload(), "profile.updated");
    }

    public void publishPhotoUpdated(String userId, String photoProfil) {
        Map<String, Object> payload = Map.of(
            "userId",       userId,
            "photoUrl",     photoProfil,
            "emailChanged", false
        );
        publish(RabbitMQConfig.EXCHANGE_USER, RabbitMQConfig.KEY_PHOTO_UPDATED,
                payload, "photo.updated → auth-service");
    }

    private void publishPhotoUpdated(UserEvent event) {
        publish(RabbitMQConfig.EXCHANGE_USER, RabbitMQConfig.KEY_PHOTO_UPDATED,
                event.getPayload(), "photo.updated");
    }

    public void publishAvisSubmitted(String userId, String agenceId, String agenceNom,
                                     int note, String commentaire) {
        Map<String, Object> payload = Map.of(
            "userId",      userId,
            "agenceId",    agenceId,
            "agenceNom",   agenceNom   != null ? agenceNom   : "",
            "note",        note,
            "commentaire", commentaire != null ? commentaire : ""
        );
        publish(RabbitMQConfig.EXCHANGE_NOTIFICATION, RabbitMQConfig.KEY_AVIS_SUBMITTED,
                payload, "avis.submitted");
    }

    
    public void publishStaffCreated(String userId, String email, String role, 
                                    String agenceId, String filialeId, String createdBy) {
        Map<String, Object> payload = Map.of(
            "userId",     userId,
            "email",      email,
            "role",       role,
            "agenceId",   agenceId != null ? agenceId : "",
            "filialeId",  filialeId != null ? filialeId : "",
            "createdBy",  createdBy,
            "timestamp",  java.time.Instant.now().toString()
        );
        publish(RabbitMQConfig.EXCHANGE_NOTIFICATION, RabbitMQConfig.KEY_STAFF_CREATED,
                payload, "staff.created");
    }

    private void publishStaffCreated(UserEvent event) {
        publish(RabbitMQConfig.EXCHANGE_NOTIFICATION, RabbitMQConfig.KEY_STAFF_CREATED,
                event.getPayload(), "staff.created");
    }

    
    public void publishStaffDeleted(String userId, String email, String role,
                                    String agenceId, String filialeId, String deletedBy) {
        Map<String, Object> payload = Map.of(
            "userId",     userId,
            "email",      email,
            "role",       role,
            "agenceId",   agenceId != null ? agenceId : "",
            "filialeId",  filialeId != null ? filialeId : "",
            "deletedBy",  deletedBy,
            "timestamp",  java.time.Instant.now().toString()
        );
        publish(RabbitMQConfig.EXCHANGE_NOTIFICATION, RabbitMQConfig.KEY_STAFF_DELETED,
                payload, "staff.deleted");
    }

    private void publishStaffDeleted(UserEvent event) {
        publish(RabbitMQConfig.EXCHANGE_NOTIFICATION, RabbitMQConfig.KEY_STAFF_DELETED,
                event.getPayload(), "staff.deleted");
    }

   
    public void publishStaffToAuth(UUID userId, String email, String temporaryPassword,
                                   String role, String name, String surname, String phone,
                                   String adresse, String filialeId, String agenceId,
                                   String poste, String numeroPermis) {
        Map<String, Object> payload = new java.util.HashMap<>();
        payload.put("userId", userId.toString());
        payload.put("email", email.toLowerCase().strip());
        payload.put("passwordTemp", temporaryPassword);
        payload.put("role", role);
        payload.put("name", name);
        payload.put("surname", surname);
        payload.put("phone", phone);
        payload.put("adresse", adresse != null && !adresse.isBlank() ? adresse : null);
        payload.put("filialeId", filialeId != null && !filialeId.isBlank() ? filialeId : null);
        payload.put("agenceId", agenceId != null && !agenceId.isBlank() ? agenceId : null);
        
        if (poste != null && !poste.isBlank()) {
            payload.put("poste", poste);
        }
        if (numeroPermis != null && !numeroPermis.isBlank()) {
            payload.put("numeroPermis", numeroPermis);
        }
        
        publish(RabbitMQConfig.EXCHANGE_USER, RabbitMQConfig.KEY_STAFF_TO_AUTH,
                payload, "staff.to.auth");
    }

    private void publish(String exchange, String routingKey,
                         Map<String, Object> payload, String label) {
        try {
            rabbitTemplate.convertAndSend(exchange, routingKey, payload);
            log.info("[PUBLISHER] {} | exchange={} routingKey={}", label, exchange, routingKey);
        } catch (Exception e) {
            log.error("[PUBLISHER] Erreur {} : {}", label, e.getMessage());
        }
    }
}