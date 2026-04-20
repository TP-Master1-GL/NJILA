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
    public static final String BOOKING_EXCHANGE     = "njila.booking.exchange";
    public static final String PAYMENT_EXCHANGE     = "njila.payment.exchange";
    public static final String FLEET_EXCHANGE       = "njila.fleet.exchange";
    public static final String USER_EXCHANGE        = "njila.user.exchange";

    // ── Dead Letter Exchange — identique à tous les autres services ───────────
    public static final String EXCHANGE_DEAD_LETTER = "njila.dead.letter.exchange";
    public static final String DEAD_LETTER_KEY      = "dead.letter";

    // ── TTL — identique au user-service (24h) ─────────────────────────────────
    public static final long MESSAGE_TTL = 86_400_000L;

    // ─── Routing keys publiées par ce service ─────────────────────────────────
    public static final String BOOKING_CREATED_KEY          = "booking.created";
    public static final String TICKET_GENERATED_KEY         = "ticket.generated";
    public static final String BOOKING_REFUND_REQUESTED_KEY = "booking.refund.requested";
    public static final String BOOKING_DEPART_KEY           = "booking.depart";

    // ─── Routing keys consommées depuis payment.exchange ──────────────────────
    public static final String PAYMENT_CONFIRMED_KEY = "payment.confirmed";
    public static final String PAYMENT_FAILED_KEY    = "payment.failed";

    // ─── Routing keys consommées depuis user.exchange ─────────────────────────
    public static final String USER_REGISTERED_BOOKING_KEY = "user.registered.booking";
    public static final String USER_UPDATED_BOOKING_KEY    = "user.updated.booking";

    // ─── Routing keys consommées depuis fleet.exchange (spécifiques) ──────────
    // Remplace l'ancien wildcard fleet.# — chaque key est désormais explicite
    // pour n'accepter que les messages réellement destinés au booking
    public static final String FLEET_AGENCY_UPDATED_KEY  = "agency.updated";
    public static final String FLEET_FILIALE_UPDATED_KEY = "filiale.updated";
    public static final String FLEET_VOYAGE_UPDATED_KEY  = "voyage.updated";
    public static final String FLEET_BUS_UPDATED_KEY     = "bus.updated";

    // ─── Routing key consommée depuis booking.exchange ────────────────────────
    // Le fleet-service publie voyage.cancelled sur booking.exchange
    public static final String VOYAGE_CANCELLED_KEY = "voyage.cancelled";

    // ─── Noms des queues consommées ───────────────────────────────────────────
    public static final String PAYMENT_SUCCESS_QUEUE  = "njila.payment.success.queue";
    public static final String PAYMENT_FAILED_QUEUE   = "njila.payment.failed.queue";
    public static final String USER_SYNC_QUEUE        = "njila.booking.sync.user.queue";

    // Une queue dédiée par type d'événement fleet
    // Évite qu'un message mal formé d'un type bloque les autres
    public static final String FLEET_AGENCY_QUEUE     = "njila.booking.sync.fleet.agency.queue";
    public static final String FLEET_FILIALE_QUEUE    = "njila.booking.sync.fleet.filiale.queue";
    public static final String FLEET_VOYAGE_QUEUE     = "njila.booking.sync.fleet.voyage.queue";
    public static final String FLEET_BUS_QUEUE        = "njila.booking.sync.fleet.bus.queue";
    public static final String VOYAGE_CANCELLED_QUEUE = "njila.booking.voyage-cancelled.queue";

    // ─────────────────────────────────────────────────────────────────────────
    // DEAD LETTER EXCHANGE
    // ─────────────────────────────────────────────────────────────────────────

    @Bean
    public DirectExchange deadLetterExchange() {
        return ExchangeBuilder
                .directExchange(EXCHANGE_DEAD_LETTER)
                .durable(true)
                .build();
    }

    @Bean
    public Queue deadLetterQueue() {
        return QueueBuilder
                .durable("njila.booking.dead.letter.queue")
                .build();
    }

    @Bean
    public Binding deadLetterBinding() {
        return BindingBuilder
                .bind(deadLetterQueue())
                .to(deadLetterExchange())
                .with(DEAD_LETTER_KEY);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // EXCHANGES métier
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
    // QUEUES payment
    // ─────────────────────────────────────────────────────────────────────────

    @Bean
    public Queue paymentSuccessQueue() {
        return durableQueue(PAYMENT_SUCCESS_QUEUE);
    }

    @Bean
    public Queue paymentFailedQueue() {
        return durableQueue(PAYMENT_FAILED_QUEUE);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // QUEUES user
    // ─────────────────────────────────────────────────────────────────────────

    @Bean
    public Queue userSyncQueue() {
        return durableQueue(USER_SYNC_QUEUE);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // QUEUES fleet — une par type d'événement
    // ─────────────────────────────────────────────────────────────────────────

    @Bean
    public Queue fleetAgencyQueue() {
        return durableQueue(FLEET_AGENCY_QUEUE);
    }

    @Bean
    public Queue fleetFilialeQueue() {
        return durableQueue(FLEET_FILIALE_QUEUE);
    }

    @Bean
    public Queue fleetVoyageQueue() {
        return durableQueue(FLEET_VOYAGE_QUEUE);
    }

    @Bean
    public Queue fleetBusQueue() {
        return durableQueue(FLEET_BUS_QUEUE);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // QUEUE booking — voyage annulé
    // ─────────────────────────────────────────────────────────────────────────

    @Bean
    public Queue voyageCancelledQueue() {
        return durableQueue(VOYAGE_CANCELLED_QUEUE);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // BINDINGS payment
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
    // BINDINGS user
    // ─────────────────────────────────────────────────────────────────────────

    @Bean
    public Binding userRegisteredBookingBinding() {
        return BindingBuilder
                .bind(userSyncQueue())
                .to(userExchange())
                .with(USER_REGISTERED_BOOKING_KEY);
    }

    @Bean
    public Binding userUpdatedBookingBinding() {
        return BindingBuilder
                .bind(userSyncQueue())
                .to(userExchange())
                .with(USER_UPDATED_BOOKING_KEY);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // BINDINGS fleet — routing keys explicites, plus de wildcard fleet.#
    // ─────────────────────────────────────────────────────────────────────────

    @Bean
    public Binding fleetAgencyBinding() {
        return BindingBuilder
                .bind(fleetAgencyQueue())
                .to(fleetExchange())
                .with(FLEET_AGENCY_UPDATED_KEY);  // "agency.updated"
    }

    @Bean
    public Binding fleetFilialeBinding() {
        return BindingBuilder
                .bind(fleetFilialeQueue())
                .to(fleetExchange())
                .with(FLEET_FILIALE_UPDATED_KEY); // "filiale.updated"
    }

    @Bean
    public Binding fleetVoyageBinding() {
        return BindingBuilder
                .bind(fleetVoyageQueue())
                .to(fleetExchange())
                .with(FLEET_VOYAGE_UPDATED_KEY);  // "voyage.updated"
    }

    @Bean
    public Binding fleetBusBinding() {
        return BindingBuilder
                .bind(fleetBusQueue())
                .to(fleetExchange())
                .with(FLEET_BUS_UPDATED_KEY);     // "bus.updated"
    }

    // ─────────────────────────────────────────────────────────────────────────
    // BINDING booking.exchange — voyage annulé publié par fleet-service
    // ─────────────────────────────────────────────────────────────────────────

    @Bean
    public Binding voyageCancelledBinding() {
        return BindingBuilder
                .bind(voyageCancelledQueue())
                .to(bookingExchange())
                .with(VOYAGE_CANCELLED_KEY);      // "voyage.cancelled"
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

    // ─────────────────────────────────────────────────────────────────────────
    // HELPER — TTL + DLX uniformes sur toutes les queues métier
    // ─────────────────────────────────────────────────────────────────────────

    private Queue durableQueue(String name) {
        return QueueBuilder.durable(name)
                .withArgument("x-dead-letter-exchange",    EXCHANGE_DEAD_LETTER)
                .withArgument("x-dead-letter-routing-key", DEAD_LETTER_KEY)
                .withArgument("x-message-ttl",             MESSAGE_TTL)
                .build();
    }
}