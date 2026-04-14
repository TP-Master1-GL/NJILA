package com.njila.njila_booking_service.config;

import org.springframework.amqp.core.*;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitMQConfig {

    // ─── Exchanges ────────────────────────────────────────────────────────────
    public static final String BOOKING_EXCHANGE = "njila.booking.exchange";
    public static final String PAYMENT_EXCHANGE = "njila.payment.exchange";
    public static final String FLEET_EXCHANGE   = "njila.fleet.exchange";
    public static final String USER_EXCHANGE    = "njila.user.exchange";

    // ─── Routing keys publiées par ce service ─────────────────────────────────
    public static final String BOOKING_CREATED_KEY          = "booking.created";
    public static final String TICKET_GENERATED_KEY         = "ticket.generated";

    // CORRECTION UC-B4 : remboursement après annulation
    public static final String BOOKING_REFUND_REQUESTED_KEY = "booking.refund.requested";

    // NOUVEAU UC-B7 : clôture départ
    public static final String BOOKING_DEPART_KEY           = "booking.depart";

    // ─── Routing keys consommées par ce service ───────────────────────────────
    public static final String PAYMENT_CONFIRMED_KEY = "payment.confirmed";
    public static final String PAYMENT_FAILED_KEY    = "payment.failed";
    public static final String FLEET_SYNC_KEY        = "fleet.#";
    public static final String USER_SYNC_KEY         = "user.#";

    // ─── Noms des queues consommées ───────────────────────────────────────────
    public static final String PAYMENT_SUCCESS_QUEUE = "njila.payment.success.queue";
    public static final String PAYMENT_FAILED_QUEUE  = "njila.payment.failed.queue";
    public static final String FLEET_SYNC_QUEUE      = "njila.booking.sync.fleet.queue";
    public static final String USER_SYNC_QUEUE       = "njila.booking.sync.user.queue";

    // ─────────────────────────────────────────────────────────────────────────
    // EXCHANGES
    // ─────────────────────────────────────────────────────────────────────────

    @Bean
    public TopicExchange bookingExchange() {
        return new TopicExchange(BOOKING_EXCHANGE, true, false);
    }

    @Bean
    public TopicExchange paymentExchange() {
        return new TopicExchange(PAYMENT_EXCHANGE, true, false);
    }

    @Bean
    public TopicExchange fleetExchange() {
        return new TopicExchange(FLEET_EXCHANGE, true, false);
    }

    @Bean
    public TopicExchange userExchange() {
        return new TopicExchange(USER_EXCHANGE, true, false);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // QUEUES consommées par ce service
    // ─────────────────────────────────────────────────────────────────────────

    @Bean
    public Queue paymentSuccessQueue() {
        return QueueBuilder.durable(PAYMENT_SUCCESS_QUEUE)
                .withArgument("x-dead-letter-exchange", "njila.dlx")
                .withArgument("x-dead-letter-routing-key", "payment.success.dead")
                .build();
    }

    @Bean
    public Queue paymentFailedQueue() {
        return QueueBuilder.durable(PAYMENT_FAILED_QUEUE)
                .withArgument("x-dead-letter-exchange", "njila.dlx")
                .withArgument("x-dead-letter-routing-key", "payment.failed.dead")
                .build();
    }

    @Bean
    public Queue fleetSyncQueue() {
        return QueueBuilder.durable(FLEET_SYNC_QUEUE).build();
    }

    @Bean
    public Queue userSyncQueue() {
        return QueueBuilder.durable(USER_SYNC_QUEUE).build();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // BINDINGS
    // ─────────────────────────────────────────────────────────────────────────

    @Bean
    public Binding paymentSuccessBinding() {
        return BindingBuilder
                .bind(paymentSuccessQueue())
                .to(paymentExchange())
                .with(PAYMENT_CONFIRMED_KEY);
    }

    @Bean
    public Binding paymentFailedBinding() {
        return BindingBuilder
                .bind(paymentFailedQueue())
                .to(paymentExchange())
                .with(PAYMENT_FAILED_KEY);
    }

    @Bean
    public Binding fleetSyncBinding() {
        return BindingBuilder
                .bind(fleetSyncQueue())
                .to(fleetExchange())
                .with(FLEET_SYNC_KEY);
    }

    @Bean
    public Binding userSyncBinding() {
        return BindingBuilder
                .bind(userSyncQueue())
                .to(userExchange())
                .with(USER_SYNC_KEY);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SÉRIALISATION JSON
    // ─────────────────────────────────────────────────────────────────────────

    @Bean
    public Jackson2JsonMessageConverter messageConverter() {
        return new Jackson2JsonMessageConverter();
    }

    @Bean
    public RabbitTemplate rabbitTemplate(ConnectionFactory connectionFactory) {
        RabbitTemplate template = new RabbitTemplate(connectionFactory);
        template.setMessageConverter(messageConverter());
        return template;
    }
}