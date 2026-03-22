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
    public static final String BOOKING_EXCHANGE  = "njila.booking.exchange";
    public static final String PAYMENT_EXCHANGE  = "njila.payment.exchange";

    // ─── Routing keys publiées par ce service ─────────────────────────────────
    public static final String BOOKING_CREATED_KEY   = "booking.created";
    public static final String TICKET_GENERATED_KEY  = "ticket.generated";
    public static final String FIDELITE_REWARD_KEY   = "booking.fidelite.reward";

    // ─── Routing keys consommées par ce service ───────────────────────────────
    public static final String PAYMENT_CONFIRMED_KEY = "payment.confirmed";
    public static final String PAYMENT_FAILED_KEY    = "payment.failed";

    // ─── Noms des queues consommées ───────────────────────────────────────────
    public static final String PAYMENT_SUCCESS_QUEUE = "njila.payment.success.queue";
    public static final String PAYMENT_FAILED_QUEUE  = "njila.payment.failed.queue";

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

    // ─────────────────────────────────────────────────────────────────────────
    // QUEUES consommées par ce service
    // ─────────────────────────────────────────────────────────────────────────

    // payment.confirmed → confirmer réservation + générer billet
    @Bean
    public Queue paymentSuccessQueue() {
        return QueueBuilder.durable(PAYMENT_SUCCESS_QUEUE).build();
    }

    // payment.failed → libérer verrou + annuler réservation
    @Bean
    public Queue paymentFailedQueue() {
        return QueueBuilder.durable(PAYMENT_FAILED_QUEUE).build();
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