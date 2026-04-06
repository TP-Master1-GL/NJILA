package com.njila.njila_user_service.events.publisher;

import com.njila.njila_user_service.config.RabbitMQConfig;
import com.njila.njila_user_service.observer.IUserObserver;
import com.njila.njila_user_service.observer.UserEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * EventPublisher v1.4.
 *
 * Événements publiés :
 *   njila.user.exchange         → user.profile.created  (confirmation vers auth)
 *   njila.user.exchange         → user.photo.updated    (sync photo → auth-service)
 *   njila.notification.exchange → user.profile.updated
 *   njila.notification.exchange → avis.submitted
 */
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

    /**
     * Synchronisation photo vers auth-service.
     * Le auth-service écoute user.photo.updated et met à jour NjilaUser.photo_url.
     * Payload : { userId, photoUrl, emailChanged: false }
     */
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

    private void publish(String exchange, String routingKey,
                         Map<String, Object> payload, String label) {
        try {
            rabbitTemplate.convertAndSend(exchange, routingKey, payload);
            log.info("[PUBLISHER] {} | exchange={}", label, exchange);
        } catch (Exception e) {
            log.error("[PUBLISHER] Erreur {} : {}", label, e.getMessage());
        }
    }
}