package com.njila.njila_user_service.observer;

/**
 * IUserSubject — pattern Observer (diagramme UML).
 * Le UserService implémente cette interface pour notifier ses observateurs.
 */
public interface IUserSubject {
    void subscribe(IUserObserver observer);
    void unsubscribe(IUserObserver observer);
    void notifyObservers(UserEvent event);
}