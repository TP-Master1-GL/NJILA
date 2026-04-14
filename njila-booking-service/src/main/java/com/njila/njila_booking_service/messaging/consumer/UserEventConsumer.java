package com.njila.njila_booking_service.messaging.consumer;

import com.njila.njila_booking_service.config.RabbitMQConfig;
import com.njila.njila_booking_service.domain.entity.projection.UserData;
import com.njila.njila_booking_service.repository.projection.UserDataRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class UserEventConsumer {

    private final UserDataRepository userRepository;

    @RabbitListener(queues = RabbitMQConfig.USER_SYNC_QUEUE)
    public void consumeUserEvent(Map<String, Object> event) {
        String type = (String) event.get("type");
        log.info("[USER-SYNC] Événement reçu type={}", type);

        if ("user.registered".equals(type) || "user.updated".equals(type) || "USER_CREATED".equals(type) || "USER_UPDATED".equals(type)) {
            Map<String, Object> data = (Map<String, Object>) event.get("data");
            String userId = data.get("userId") != null ? data.get("userId").toString() : data.get("id").toString();
            
            UserData user = UserData.builder()
                    .id(userId)
                    .nom(data.getOrDefault("name", data.getOrDefault("nom", "")).toString())
                    .prenom(data.getOrDefault("surname", data.getOrDefault("prenom", "")).toString())
                    .telephone(data.getOrDefault("phone", data.getOrDefault("telephone", "")).toString())
                    .email(data.getOrDefault("email", "").toString())
                    .adresse(data.getOrDefault("address", data.getOrDefault("adresse", "")).toString())
                    .photoUrl(data.getOrDefault("photo_portrait_url", "").toString())
                    .role(data.getOrDefault("role", "").toString())
                    .agenceId(data.getOrDefault("agence_id", "").toString())
                    .filialeId(data.getOrDefault("filiale_id", "").toString())
                    .build();
            userRepository.save(user);
            log.info("[USER-SYNC] Utilisateur synchronisé ID={}", user.getId());
        }
    }
}
