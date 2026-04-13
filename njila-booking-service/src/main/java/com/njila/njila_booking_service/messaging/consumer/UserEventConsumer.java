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

        if ("USER_CREATED".equals(type) || "USER_UPDATED".equals(type)) {
            Map<String, Object> data = (Map<String, Object>) event.get("data");
            UserData user = UserData.builder()
                    .id(Long.valueOf(data.get("id").toString()))
                    .nom(data.get("nom").toString())
                    .prenom(data.get("surname").toString()) // surname matches 'prenom' in our entity
                    .telephone(data.get("phone").toString())
                    .email(data.get("email").toString())
                    .role(data.get("role").toString())
                    .build();
            userRepository.save(user);
            log.info("[USER-SYNC] Utilisateur synchronisé ID={}", user.getId());
        }
    }
}
