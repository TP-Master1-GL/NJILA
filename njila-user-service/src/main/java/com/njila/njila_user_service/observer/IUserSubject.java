package com.njila.njila_user_service.observer;

public interface IUserSubject {
    void subscribe(IUserObserver observer);
    void unsubscribe(IUserObserver observer);
    void notifyObservers(UserEvent event);
}