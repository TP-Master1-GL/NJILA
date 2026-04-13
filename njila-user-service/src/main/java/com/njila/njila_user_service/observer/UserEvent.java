package com.njila.njila_user_service.observer;

import com.njila.njila_user_service.enums.UserEventType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;


@Getter
@Builder
@AllArgsConstructor
public class UserEvent {

    private final UserEventType         eventType;
    private final String                sourceUserId;
    private final String                targetUserId;
    private final String                timestamp;
    private final Map<String, Object>   payload;

    public static UserEvent of(
        UserEventType       eventType,
        UUID                sourceUserId,
        UUID                targetUserId,
        Map<String, Object> payload
    ) {
        return UserEvent.builder()
            .eventType(eventType)
            .sourceUserId(sourceUserId != null ? sourceUserId.toString() : null)
            .targetUserId(targetUserId != null ? targetUserId.toString() : null)
            .timestamp(Instant.now().toString())
            .payload(payload != null ? payload : Map.of())
            .build();
    }
}