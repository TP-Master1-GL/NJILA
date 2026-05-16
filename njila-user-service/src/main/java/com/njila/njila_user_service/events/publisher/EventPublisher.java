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
        log.debug("[PUBLISHER] Event: {}", event.getEventType());
        switch (event.getEventType()) {
            case PROFIL_MODIFIER  -> publishProfileUpdated(event);
            case PHOTO_MISE_A_JOUR -> publishPhotoUpdated(event);
            case COMPTE_CREE      -> publishProfileCreated(event);
            case COMPTE_SUPPRIMER -> publishStaffDeleted(event);
            case STAFF_CREE       -> publishStaffCreated(event);
            default -> log.debug("[PUBLISHER] Event ignoré: {}", event.getEventType());
        }
    }

    public void publishProfileCreated(UserEvent event) {
        publish(RabbitMQConfig.EXCHANGE_USER, RabbitMQConfig.KEY_PROFILE_CREATED,
                event.getPayload(), "profile.created");
    }

    public void publishProfileUpdated(UserEvent event) {
        // Publier sur le topic user.updated pour auth-service
        publish(RabbitMQConfig.EXCHANGE_USER, RabbitMQConfig.KEY_USER_UPDATED,
                event.getPayload(), "user.updated");
        
        // Publier aussi sur notification pour les notifications
        publish(RabbitMQConfig.EXCHANGE_NOTIFICATION, RabbitMQConfig.KEY_PROFILE_UPDATED,
                event.getPayload(), "profile.updated");
    }

    /**
     * Met à jour le profil utilisateur dans auth-service
     * @param userId ID de l'utilisateur
     * @param email Email (peut être modifié)
     * @param name Prénom
     * @param surname Nom
     * @param phone Téléphone
     * @param adresse Adresse
     * @param photoUrl URL de la photo
     * @param emailChanged Indique si l'email a changé
     */
    public void publishUserUpdateToAuth(String userId, String email, String name, 
                                        String surname, String phone, String adresse,
                                        String photoUrl, boolean emailChanged) {
        Map<String, Object> payload = Map.ofEntries(
            Map.entry("userId", userId),
            Map.entry("email", email),
            Map.entry("name", name != null ? name : ""),
            Map.entry("surname", surname != null ? surname : ""),
            Map.entry("phone", phone != null ? phone : ""),
            Map.entry("adresse", adresse != null ? adresse : ""),
            Map.entry("photo_url", photoUrl != null ? photoUrl : ""),
            Map.entry("emailChanged", emailChanged),
            Map.entry("eventType", "USER_UPDATED"),
            Map.entry("timestamp", java.time.Instant.now().toString())
        );
        
        publish(RabbitMQConfig.EXCHANGE_USER, RabbitMQConfig.KEY_USER_UPDATED,
                payload, "user.update.to.auth");
    }

    public void publishPhotoUpdated(String userId, String photoProfil) {
        Map<String, Object> payload = Map.of(
            "userId", userId,
            "photo_url", photoProfil,
            "emailChanged", false,
            "eventType", "PHOTO_UPDATED"
        );
        
        // Publier sur user exchange pour auth-service
        publish(RabbitMQConfig.EXCHANGE_USER, RabbitMQConfig.KEY_PHOTO_UPDATED,
                payload, "photo.updated");
        
        // Publier aussi sur user.updated pour auth-service
        publish(RabbitMQConfig.EXCHANGE_USER, RabbitMQConfig.KEY_USER_UPDATED,
                payload, "user.update.from.photo");
    }

    private void publishPhotoUpdated(UserEvent event) {
        publishPhotoUpdated(
            (String) event.getPayload().get("userId"),
            (String) event.getPayload().get("photoUrl")
        );
    }

    public void publishAvisSubmitted(String userId, String agenceId, String agenceNom,
                                     int note, String commentaire) {
        Map<String, Object> payload = Map.of(
            "userId",      userId,
            "agenceId",    agenceId,
            "agenceNom",   agenceNom    != null ? agenceNom    : "",
            "note",        note,
            "commentaire", commentaire  != null ? commentaire  : ""
        );
        publish(RabbitMQConfig.EXCHANGE_NOTIFICATION, RabbitMQConfig.KEY_AVIS_SUBMITTED,
                payload, "avis.submitted");
    }

    public void publishStaffCreated(String userId, String email, String role,
                                    String agenceId, String filialeId, String createdBy) {
        Map<String, Object> payload = Map.of(
            "userId",    userId,
            "email",     email,
            "role",      role,
            "agenceId",  agenceId   != null ? agenceId   : "",
            "filialeId", filialeId  != null ? filialeId  : "",
            "createdBy", createdBy,
            "eventType", "STAFF_CREATED",
            "timestamp", java.time.Instant.now().toString()
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
            "userId",    userId,
            "email",     email,
            "role",      role,
            "agenceId",  agenceId   != null ? agenceId   : "",
            "filialeId", filialeId  != null ? filialeId  : "",
            "deletedBy", deletedBy,
            "timestamp", java.time.Instant.now().toString()
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

        log.info("[PUBLISHER] staff.to.auth | userId={} role={} email={}", userId, role, email);

        java.util.Map<String, Object> payload = new java.util.HashMap<>();
        payload.put("userId",       userId.toString());
        payload.put("email",        email.toLowerCase().strip());
        payload.put("passwordTemp", temporaryPassword);
        payload.put("role",         role);
        payload.put("name",         name);
        payload.put("surname",      surname);
        payload.put("phone",        phone);
        payload.put("adresse",      adresse      != null && !adresse.isBlank()      ? adresse      : null);
        payload.put("filialeId",    filialeId    != null && !filialeId.isBlank()    ? filialeId    : null);
        payload.put("agenceId",     agenceId     != null && !agenceId.isBlank()     ? agenceId     : null);
        if (poste        != null && !poste.isBlank())        payload.put("poste",        poste);
        if (numeroPermis != null && !numeroPermis.isBlank()) payload.put("numeroPermis", numeroPermis);

        publish(RabbitMQConfig.EXCHANGE_USER, RabbitMQConfig.KEY_STAFF_TO_AUTH,
                payload, "staff.to.auth");
    }

    public void publishChauffeurToFleet(UUID userId, String email, String name, String surname,
                                        String phone, String adresse,
                                        String agenceId, String filialeId,
                                        String numeroPermis, String dateEmbauche) {

        log.info("[PUBLISHER] chauffeur.to.fleet | userId={} email={} agenceId={}",
                 userId, email, agenceId);

        java.util.Map<String, Object> payload = new java.util.HashMap<>();
        payload.put("userId",       userId.toString());
        payload.put("email",        email.toLowerCase().strip());
        payload.put("name",         name);
        payload.put("surname",      surname);
        payload.put("phone",        phone);
        payload.put("adresse",      adresse      != null ? adresse      : "");
        payload.put("agenceId",     agenceId     != null ? agenceId     : "");
        payload.put("filialeId",    filialeId    != null ? filialeId    : "");
        payload.put("numeroPermis", numeroPermis != null ? numeroPermis : "");
        payload.put("dateEmbauche", dateEmbauche != null ? dateEmbauche : "");
        payload.put("eventType",    "CHAUFFEUR_CREATED");
        payload.put("timestamp",    java.time.Instant.now().toString());

        publish(RabbitMQConfig.EXCHANGE_USER, RabbitMQConfig.KEY_CHAUFFEUR_TO_FLEET,
                payload, "chauffeur.to.fleet");
    }

    private void publish(String exchange, String routingKey,
                         java.util.Map<String, Object> payload, String label) {
        try {
            rabbitTemplate.convertAndSend(exchange, routingKey, payload);
            log.info("[PUBLISHER] Sent | {} | exchange={} key={}", label, exchange, routingKey);
        } catch (Exception e) {
            log.error("[PUBLISHER] Failed {}: {}", label, e.getMessage());
        }
    }
}
