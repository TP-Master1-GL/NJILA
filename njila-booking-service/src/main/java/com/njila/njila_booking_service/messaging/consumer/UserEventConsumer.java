package com.njila.njila_booking_service.messaging.consumer;

import com.njila.njila_booking_service.config.RabbitMQConfig;
import com.njila.njila_booking_service.domain.entity.projection.UserData;
import com.njila.njila_booking_service.repository.projection.UserDataRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Slf4j
public class UserEventConsumer {

    private final UserDataRepository userRepository;

    // Types acceptés — alignés sur ce que l'auth-service publie réellement
    private static final Set<String> HANDLED_TYPES = Set.of(
            "user.registered",
            "user.updated"
    );

    @RabbitListener(queues = RabbitMQConfig.USER_SYNC_QUEUE)
    public void consumeUserEvent(Map<String, Object> event) {

        // ── Validation de l'enveloppe ─────────────────────────────────────────
        if (event == null) {
            log.warn("[USER-SYNC] Message null reçu, ignoré");
            return;
        }

        String type = getString(event, "type");

        if (!HANDLED_TYPES.contains(type)) {
            log.warn("[USER-SYNC] Type non géré ou absent : '{}', message ignoré", type);
            return;
        }

        // ── Extraction du payload data ────────────────────────────────────────
        Object rawData = event.get("data");
        if (!(rawData instanceof Map)) {
            log.error("[USER-SYNC] Champ 'data' absent ou invalide pour type={}", type);
            return;
        }

        @SuppressWarnings("unchecked")
        Map<String, Object> data = (Map<String, Object>) rawData;

        // ── Résolution de l'identifiant utilisateur ───────────────────────────
        // L'auth-service publie userId et id en doublon — on prend le premier non-null
        String userId = firstNonNull(data, "userId", "id");
        if (userId == null || userId.isBlank()) {
            log.error("[USER-SYNC] Impossible de résoudre l'userId pour type={}, data={}", type, data);
            return;
        }

        try {
            UserData user = UserData.builder()
                    .id(userId)
                    // nom : priorité au champ "name", fallback sur "nom"
                    .nom(firstNonNullOrEmpty(data, "name", "nom"))
                    // prénom : priorité au champ "surname", fallback sur "prenom"
                    .prenom(firstNonNullOrEmpty(data, "surname", "prenom"))
                    // téléphone : priorité au champ "phone", fallback sur "telephone"
                    .telephone(firstNonNullOrEmpty(data, "phone", "telephone"))
                    .email(getString(data, "email"))
                    // adresse : priorité au champ "adresse", fallback sur "address"
                    .adresse(firstNonNullOrEmpty(data, "adresse", "address"))
                    // photo : le payload booking utilise "photo_portrait_url", fallback sur "photoUrl"
                    .photoUrl(firstNonNullOrEmpty(data, "photo_portrait_url", "photoUrl"))
                    .role(getString(data, "role"))
                    .agenceId(getString(data, "agence_id"))
                    .filialeId(getString(data, "filiale_id"))
                    .build();

            userRepository.save(user);
            log.info("[USER-SYNC] Utilisateur synchronisé — type={} ID={}", type, userId);

        } catch (Exception e) {
            // On loggue sans relancer : évite la boucle de retry infinie
            // Le message sera expiré par le TTL et routé vers le DLX après 24h
            log.error("[USER-SYNC] Erreur lors de la synchronisation userId={} type={} : {}",
                    userId, type, e.getMessage(), e);
        }
    }

    // ── Helpers d'extraction null-safe ────────────────────────────────────────

    /**
     * Retourne la valeur string de la première clé trouvée non-null dans la map.
     * Retourne null si aucune clé ne correspond.
     */
    private String firstNonNull(Map<String, Object> map, String... keys) {
        for (String key : keys) {
            Object val = map.get(key);
            if (val != null && !val.toString().isBlank()) {
                return val.toString();
            }
        }
        return null;
    }

    /**
     * Comme firstNonNull, mais retourne "" au lieu de null — pour les champs non critiques.
     */
    private String firstNonNullOrEmpty(Map<String, Object> map, String... keys) {
        String result = firstNonNull(map, keys);
        return result != null ? result : "";
    }

    /**
     * Retourne la valeur string d'une clé, ou "" si absente ou null.
     */
    private String getString(Map<String, Object> map, String key) {
        Object val = map.get(key);
        return val != null ? val.toString() : "";
    }
}