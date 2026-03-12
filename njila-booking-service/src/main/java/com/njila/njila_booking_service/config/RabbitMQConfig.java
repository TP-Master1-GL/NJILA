package com.njila.njila_booking_service.config;

import org.springframework.amqp.core.*;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitMQConfig {

    // ── Exchanges ─────────────────────────────────────────────────────────────
    public static final String BOOKING_EXCHANGE     = "njila.booking.exchange";
    public static final String PAYMENT_EXCHANGE     = "njila.payment.exchange";
    public static final String FLEET_EXCHANGE       = "njila.fleet.exchange";
    public static final String DEAD_LETTER_EXCHANGE = "njila.dead.letter.exchange";

    // ── Routing keys publiées ─────────────────────────────────────────────────
    public static final String BOOKING_CREATED   = "booking.created";
    public static final String BOOKING_CONFIRMED = "booking.confirmed";
    public static final String BOOKING_CANCELLED = "booking.cancelled";

    // ── Queues consommées ─────────────────────────────────────────────────────
    public static final String PAYMENT_SUCCESS_QUEUE = "njila.payment.success.queue";
    public static final String PAYMENT_FAILED_QUEUE  = "njila.payment.failed.queue";
    public static final String FLEET_BREAKDOWN_QUEUE = "njila.fleet.bus.breakdown.queue";

    // ── Exchanges beans ───────────────────────────────────────────────────────
    @Bean public TopicExchange bookingExchange() {
        return new TopicExchange(BOOKING_EXCHANGE, true, false);
    }
    @Bean public TopicExchange paymentExchange() {
        return new TopicExchange(PAYMENT_EXCHANGE, true, false);
    }
    @Bean public TopicExchange fleetExchange() {
        return new TopicExchange(FLEET_EXCHANGE, true, false);
    }
    @Bean public DirectExchange deadLetterExchange() {
        return new DirectExchange(DEAD_LETTER_EXCHANGE, true, false);
    }

    // ── Queues ────────────────────────────────────────────────────────────────
    @Bean public Queue paymentSuccessQueue() {
        return QueueBuilder.durable(PAYMENT_SUCCESS_QUEUE)
            .withArgument("x-dead-letter-exchange", DEAD_LETTER_EXCHANGE)
            .build();
    }
    @Bean public Queue paymentFailedQueue() {
        return QueueBuilder.durable(PAYMENT_FAILED_QUEUE)
            .withArgument("x-dead-letter-exchange", DEAD_LETTER_EXCHANGE)
            .build();
    }
    @Bean public Queue fleetBreakdownQueue() {
        return QueueBuilder.durable(FLEET_BREAKDOWN_QUEUE)
            .withArgument("x-dead-letter-exchange", DEAD_LETTER_EXCHANGE)
            .build();
    }

    // ── Bindings ──────────────────────────────────────────────────────────────
    @Bean public Binding paymentSuccessBinding() {
        return BindingBuilder.bind(paymentSuccessQueue())
            .to(paymentExchange()).with("payment.success");
    }
    @Bean public Binding paymentFailedBinding() {
        return BindingBuilder.bind(paymentFailedQueue())
            .to(paymentExchange()).with("payment.failed");
    }
    @Bean public Binding fleetBreakdownBinding() {
        return BindingBuilder.bind(fleetBreakdownQueue())
            .to(fleetExchange()).with("fleet.bus.breakdown");
    }

    // ── Converter + Template ──────────────────────────────────────────────────
    @Bean public Jackson2JsonMessageConverter messageConverter() {
        return new Jackson2JsonMessageConverter();
    }
    @Bean public RabbitTemplate rabbitTemplate(ConnectionFactory factory) {
        RabbitTemplate template = new RabbitTemplate(factory);
        template.setMessageConverter(messageConverter());
        return template;
    }
}
