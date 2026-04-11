package com.njila.njila_user_service.config;

import org.springframework.amqp.core.*;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Configuration RabbitMQ — user-service v2.0.
 *
 * Flux modifiés :
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ user-service → auth-service (création staff)                           │
 * │   Exchange: njila.user.exchange                                        │
 * │   Routing key: staff.to.auth                                           │
 * │   Queue (auth-service): njila.auth.staff-creation.queue                │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * Queues consommées par user-service :
 * ┌──────────────────────────────────────────┬─────────────────────────┬────────────────────────┐
 * │ Queue                                    │ Exchange                │ Routing key            │
 * ├──────────────────────────────────────────┼─────────────────────────┼────────────────────────┤
 * │ njila.user.registered.queue              │ njila.user.exchange     │ user.registered        │
 * │ njila.user.updated.queue                 │ njila.user.exchange     │ user.updated           │
 * ├──────────────────────────────────────────┼─────────────────────────┼────────────────────────┤
 * │ njila.user.agence-created.queue          │ njila.fleet.exchange    │ agence.created         │
 * │ njila.user.filiale-created.queue         │ njila.fleet.exchange    │ filiale.created        │
 * ├──────────────────────────────────────────┼─────────────────────────┼────────────────────────┤
 * │ njila.user.reservation-created.queue     │ njila.booking.exchange  │ reservation.created    │
 * ├──────────────────────────────────────────┼─────────────────────────┼────────────────────────┤
 * │ njila.notification.staff.created.queue   │ njila.notification.exchange │ staff.created     │
 * │ njila.notification.staff.deleted.queue   │ njila.notification.exchange │ staff.deleted     │
 * └──────────────────────────────────────────┴─────────────────────────┴────────────────────────┘
 */
@Configuration
public class RabbitMQConfig {

    // ── Exchanges ──────────────────────────────────────────────────────────
    public static final String EXCHANGE_USER         = "njila.user.exchange";
    public static final String EXCHANGE_FLEET        = "njila.fleet.exchange";
    public static final String EXCHANGE_BOOKING      = "njila.booking.exchange";
    public static final String EXCHANGE_NOTIFICATION = "njila.notification.exchange";
    public static final String EXCHANGE_DEAD_LETTER  = "njila.dead.letter.exchange";

    // ── Queues consommées par user-service ─────────────────────────────────
    public static final String QUEUE_USER_REGISTERED        = "njila.user.registered.queue";
    public static final String QUEUE_USER_UPDATED           = "njila.user.updated.queue";
    public static final String QUEUE_AGENCE_CREATED         = "njila.user.agence-created.queue";
    public static final String QUEUE_FILIALE_CREATED        = "njila.user.filiale-created.queue";
    public static final String QUEUE_RESERVATION_CREATED    = "njila.user.reservation-created.queue";
    public static final String QUEUE_NOTIFICATION_STAFF_CREATED = "njila.notification.staff.created.queue";
    public static final String QUEUE_NOTIFICATION_STAFF_DELETED = "njila.notification.staff.deleted.queue";
    public static final String QUEUE_DEAD_LETTER            = "njila.dead.letter.queue";

    // ── Queues publiées par user-service vers auth-service ─────────────────
    public static final String QUEUE_STAFF_TO_AUTH = "njila.auth.staff-creation.queue";

    // ── Routing keys consommées ────────────────────────────────────────────
    public static final String KEY_USER_REGISTERED     = "user.registered";
    public static final String KEY_USER_UPDATED        = "user.updated";
    public static final String KEY_AGENCE_CREATED      = "agence.created";
    public static final String KEY_FILIALE_CREATED     = "filiale.created";
    public static final String KEY_RESERVATION_CREATED = "reservation.created";
    public static final String KEY_STAFF_CREATED       = "staff.created";
    public static final String KEY_STAFF_DELETED       = "staff.deleted";

    // ── Routing keys publiées ──────────────────────────────────────────────
    public static final String KEY_PROFILE_CREATED = "user.profile.created";
    public static final String KEY_PHOTO_UPDATED   = "user.photo.updated";
    public static final String KEY_PROFILE_UPDATED = "user.profile.updated";
    public static final String KEY_AVIS_SUBMITTED  = "avis.submitted";
    public static final String KEY_STAFF_TO_AUTH   = "staff.to.auth";
    
    // AUTRES ROUTING KEYS
    public static final String KEY_MANAGER_CREATED = "manager.created";
    public static final String KEY_EMPLOYE_CREATED = "employe.created";

    // ── Exchanges beans ────────────────────────────────────────────────────
    @Bean 
    public TopicExchange userExchange() {
        return ExchangeBuilder.topicExchange(EXCHANGE_USER).durable(true).build();
    }
    
    @Bean 
    public TopicExchange fleetExchange() {
        return ExchangeBuilder.topicExchange(EXCHANGE_FLEET).durable(true).build();
    }
    
    @Bean 
    public TopicExchange bookingExchange() {
        return ExchangeBuilder.topicExchange(EXCHANGE_BOOKING).durable(true).build();
    }
    
    @Bean 
    public TopicExchange notificationExchange() {
        return ExchangeBuilder.topicExchange(EXCHANGE_NOTIFICATION).durable(true).build();
    }
    
    @Bean 
    public DirectExchange deadLetterExchange() {
        return ExchangeBuilder.directExchange(EXCHANGE_DEAD_LETTER).durable(true).build();
    }

    // ── Queues consommées par user-service ─────────────────────────────────
    @Bean 
    public Queue userRegisteredQueue() { 
        return durableQueue(QUEUE_USER_REGISTERED); 
    }
    
    @Bean 
    public Queue userUpdatedQueue() { 
        return durableQueue(QUEUE_USER_UPDATED); 
    }
    
    @Bean 
    public Queue agenceCreatedQueue() { 
        return durableQueue(QUEUE_AGENCE_CREATED); 
    }
    
    @Bean 
    public Queue filialeCreatedQueue() { 
        return durableQueue(QUEUE_FILIALE_CREATED); 
    }
    
    @Bean 
    public Queue reservationCreatedQueue() { 
        return durableQueue(QUEUE_RESERVATION_CREATED); 
    }
    
    @Bean 
    public Queue notificationStaffCreatedQueue() { 
        return durableQueue(QUEUE_NOTIFICATION_STAFF_CREATED); 
    }
    
    @Bean 
    public Queue notificationStaffDeletedQueue() { 
        return durableQueue(QUEUE_NOTIFICATION_STAFF_DELETED); 
    }
    
    @Bean 
    public Queue deadLetterQueue() { 
        return QueueBuilder.durable(QUEUE_DEAD_LETTER).build(); 
    }

    // ── Queue publiée vers auth-service ────────────────────────────────────
    @Bean 
    public Queue staffToAuthQueue() { 
        return durableQueue(QUEUE_STAFF_TO_AUTH); 
    }

    // ── Bindings pour les queues consommées ────────────────────────────────
    @Bean 
    public Binding bindingUserRegistered() {
        return BindingBuilder.bind(userRegisteredQueue())
                .to(userExchange()).with(KEY_USER_REGISTERED);
    }
    
    @Bean 
    public Binding bindingUserUpdated() {
        return BindingBuilder.bind(userUpdatedQueue())
                .to(userExchange()).with(KEY_USER_UPDATED);
    }
    
    @Bean 
    public Binding bindingAgenceCreated() {
        return BindingBuilder.bind(agenceCreatedQueue())
                .to(fleetExchange()).with(KEY_AGENCE_CREATED);
    }
    
    @Bean 
    public Binding bindingFilialeCreated() {
        return BindingBuilder.bind(filialeCreatedQueue())
                .to(fleetExchange()).with(KEY_FILIALE_CREATED);
    }
    
    @Bean 
    public Binding bindingReservationCreated() {
        return BindingBuilder.bind(reservationCreatedQueue())
                .to(bookingExchange()).with(KEY_RESERVATION_CREATED);
    }
    
    @Bean 
    public Binding bindingNotificationStaffCreated() {
        return BindingBuilder.bind(notificationStaffCreatedQueue())
                .to(notificationExchange()).with(KEY_STAFF_CREATED);
    }
    
    @Bean 
    public Binding bindingNotificationStaffDeleted() {
        return BindingBuilder.bind(notificationStaffDeletedQueue())
                .to(notificationExchange()).with(KEY_STAFF_DELETED);
    }
    
    @Bean 
    public Binding bindingDeadLetter() {
        return BindingBuilder.bind(deadLetterQueue())
                .to(deadLetterExchange()).with("dead.letter");
    }

    // ── Binding pour la queue vers auth-service ────────────────────────────
    @Bean 
    public Binding bindingStaffToAuth() {
        return BindingBuilder.bind(staffToAuthQueue())
                .to(userExchange()).with(KEY_STAFF_TO_AUTH);
    }

    // ── Sérialisation JSON ─────────────────────────────────────────────────
    @Bean
    public MessageConverter jsonMessageConverter() {
        return new Jackson2JsonMessageConverter();
    }

    @Bean
    public RabbitTemplate rabbitTemplate(ConnectionFactory connectionFactory,
                                         MessageConverter jsonMessageConverter) {
        RabbitTemplate template = new RabbitTemplate(connectionFactory);
        template.setMessageConverter(jsonMessageConverter);
        return template;
    }

    // ── Helper ─────────────────────────────────────────────────────────────
    private Queue durableQueue(String name) {
        return QueueBuilder.durable(name)
            .withArgument("x-dead-letter-exchange",    EXCHANGE_DEAD_LETTER)
            .withArgument("x-dead-letter-routing-key", "dead.letter")
            .withArgument("x-message-ttl",             86400000L)
            .build();
    }
}