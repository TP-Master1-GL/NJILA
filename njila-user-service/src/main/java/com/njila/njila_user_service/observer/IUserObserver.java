package com.njila.njila_user_service.observer;

/**
 * IUserObserver — pattern Observer (diagramme UML).
 * Tout composant réagissant aux événements utilisateur implémente cette interface.
 *
 * Implémentations :
 *   - EventPublisher       → publie sur RabbitMQ
 *   - RedisCacheInvalidator→ invalide le cache Redis
 */
public interface IUserObserver {
    void onUserEvent(UserEvent event);
}