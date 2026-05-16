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

    public static final String EXCHANGE_DEAD_LETTER = "njila.dead.letter.exchange";
    public static final String DEAD_LETTER_KEY      = "dead.letter";

    // ─── Routing keys publiées ────────────────────────────────────────────────
    public static final String BOOKING_CREATED_KEY          = "booking.created";
    public static final String TICKET_GENERATED_KEY         = "ticket.generated";
    public static final String BOOKING_REFUND_REQUESTED_KEY = "booking.refund.requested";
    public static final String BOOKING_DEPART_KEY           = "booking.depart";

    // ─── Routing keys consommées depuis payment.exchange ─────────────────────
    public static final String PAYMENT_CONFIRMED_KEY = "payment.succeed";
    public static final String PAYMENT_FAILED_KEY    = "payment.failed";

    // ─── Routing keys consommées depuis user.exchange ─────────────────────────
    public static final String USER_REGISTERED_BOOKING_KEY = "user.registered.booking";
    public static final String USER_UPDATED_BOOKING_KEY    = "user.updated.booking";

    // ─── Routing keys consommées depuis fleet.exchange ────────────────────────
    public static final String FLEET_AGENCY_UPDATED_KEY  = "agency.updated";
    public static final String FLEET_FILIALE_UPDATED_KEY = "filiale.updated";
    public static final String FLEET_VOYAGE_UPDATED_KEY  = "voyage.updated";
    public static final String FLEET_BUS_UPDATED_KEY     = "bus.updated";
    public static final String VOYAGE_CANCELLED_KEY      = "voyage.cancelled";

    // ─── Noms des queues partagées avec payment-service ──────────────────────
    public static final String PAYMENT_SUCCESS_QUEUE = "njila.payment.success.queue";
    public static final String PAYMENT_FAILED_QUEUE  = "njila.payment.fail.queue";

    // ─── Noms des queues DLX du payment-service (pour alignement) ────────────
    //     Ces constantes servent uniquement à reproduire exactement les mêmes
    //     arguments x-dead-letter-* que le payment-service déclare.
    private static final String PAYMENT_EXCHANGE_DEAD_LETTER   = "njila.dead.letter.exchange";
    private static final String PAYMENT_SUCCESS_DLQ_ROUTING_KEY = "njila.payment.success.dlq";
    private static final String PAYMENT_FAILED_DLQ_ROUTING_KEY  = "njila.payment.fail.dlq";

    // ─── Noms des queues propres au booking-service ───────────────────────────
    public static final String USER_SYNC_QUEUE        = "njila.booking.sync.user.queue";
    public static final String FLEET_AGENCY_QUEUE     = "njila.booking.sync.fleet.agency.queue";
    public static final String FLEET_FILIALE_QUEUE    = "njila.booking.sync.fleet.filiale.queue";
    public static final String FLEET_VOYAGE_QUEUE     = "njila.booking.sync.fleet.voyage.queue";
    public static final String FLEET_BUS_QUEUE        = "njila.booking.sync.fleet.bus.queue";
    public static final String VOYAGE_CANCELLED_QUEUE = "njila.booking.voyage-cancelled.queue";

    // ════════════════════════════════════════════════════════════════════════
    // DEAD LETTER (propre au booking-service)
    // ════════════════════════════════════════════════════════════════════════

    @Bean
    public DirectExchange deadLetterExchange() {
        return ExchangeBuilder.directExchange(EXCHANGE_DEAD_LETTER).durable(true).build();
    }

    @Bean
    public Queue deadLetterQueue() {
        return QueueBuilder.durable("njila.booking.dead.letter.queue").build();
    }

    @Bean
    public Binding deadLetterBinding() {
        return BindingBuilder.bind(deadLetterQueue())
                .to(deadLetterExchange())
                .with(DEAD_LETTER_KEY);
    }

    // ════════════════════════════════════════════════════════════════════════
    // EXCHANGES
    // ════════════════════════════════════════════════════════════════════════

    @Bean public TopicExchange bookingExchange() {
        return new TopicExchange(BOOKING_EXCHANGE, true, false);
    }
    @Bean public TopicExchange paymentExchange() {
        return new TopicExchange(PAYMENT_EXCHANGE, true, false);
    }
    @Bean public TopicExchange fleetExchange() {
        return new TopicExchange(FLEET_EXCHANGE, true, false);
    }
    @Bean public TopicExchange userExchange() {
        return new TopicExchange(USER_EXCHANGE, true, false);
    }

    // ════════════════════════════════════════════════════════════════════════
    // QUEUES PARTAGÉES avec payment-service
    //
    // ⚠️  RÈGLE CRITIQUE : ces queues sont déclarées en premier par
    //     payment-service avec des arguments x-dead-letter-*.
    //     Le booking-service DOIT déclarer exactement les MÊMES arguments,
    //     sinon RabbitMQ lève PRECONDITION_FAILED au démarrage.
    //
    //     payment-service déclare :
    //       njila.payment.success.queue → SANS DLX  (durableQueue simple)
    //       njila.payment.fail.queue    → SANS DLX  (durableQueue simple)
    //
    //     → Le booking-service déclare donc aussi SANS DLX.
    // ════════════════════════════════════════════════════════════════════════

    @Bean
    public Queue paymentSuccessQueue() {
        // ✅ SANS DLX — aligné avec payment-service (durableQueue simple)
        return QueueBuilder.durable(PAYMENT_SUCCESS_QUEUE).build();
    }

    @Bean
    public Queue paymentFailedQueue() {
        // ✅ SANS DLX — aligné avec payment-service (durableQueue simple)
        return QueueBuilder.durable(PAYMENT_FAILED_QUEUE).build();
    }

    // ════════════════════════════════════════════════════════════════════════
    // QUEUES PROPRES au booking-service (avec DLX pour fiabilité)
    // ════════════════════════════════════════════════════════════════════════

    @Bean public Queue userSyncQueue() {
        return durableQueueWithDLX(USER_SYNC_QUEUE);
    }
    @Bean public Queue fleetAgencyQueue() {
        return durableQueueWithDLX(FLEET_AGENCY_QUEUE);
    }
    @Bean public Queue fleetFilialeQueue() {
        return durableQueueWithDLX(FLEET_FILIALE_QUEUE);
    }
    @Bean public Queue fleetVoyageQueue() {
        return durableQueueWithDLX(FLEET_VOYAGE_QUEUE);
    }
    @Bean public Queue fleetBusQueue() {
        return durableQueueWithDLX(FLEET_BUS_QUEUE);
    }
    @Bean public Queue voyageCancelledQueue() {
        return durableQueueWithDLX(VOYAGE_CANCELLED_QUEUE);
    }

    // ════════════════════════════════════════════════════════════════════════
    // BINDINGS payment
    // ════════════════════════════════════════════════════════════════════════

    @Bean
    public Binding paymentSuccessBinding() {
        return BindingBuilder.bind(paymentSuccessQueue())
                .to(paymentExchange()).with(PAYMENT_CONFIRMED_KEY);
    }

    @Bean
    public Binding paymentFailedBinding() {
        return BindingBuilder.bind(paymentFailedQueue())
                .to(paymentExchange()).with(PAYMENT_FAILED_KEY);
    }

    // ════════════════════════════════════════════════════════════════════════
    // BINDINGS user
    // ════════════════════════════════════════════════════════════════════════

    @Bean
    public Binding userRegisteredBookingBinding() {
        return BindingBuilder.bind(userSyncQueue())
                .to(userExchange()).with(USER_REGISTERED_BOOKING_KEY);
    }

    @Bean
    public Binding userUpdatedBookingBinding() {
        return BindingBuilder.bind(userSyncQueue())
                .to(userExchange()).with(USER_UPDATED_BOOKING_KEY);
    }

    // ════════════════════════════════════════════════════════════════════════
    // BINDINGS fleet
    // ════════════════════════════════════════════════════════════════════════

    @Bean
    public Binding fleetAgencyBinding() {
        return BindingBuilder.bind(fleetAgencyQueue())
                .to(fleetExchange()).with(FLEET_AGENCY_UPDATED_KEY);
    }

    @Bean
    public Binding fleetFilialeBinding() {
        return BindingBuilder.bind(fleetFilialeQueue())
                .to(fleetExchange()).with(FLEET_FILIALE_UPDATED_KEY);
    }

    @Bean
    public Binding fleetVoyageBinding() {
        return BindingBuilder.bind(fleetVoyageQueue())
                .to(fleetExchange()).with(FLEET_VOYAGE_UPDATED_KEY);
    }

    @Bean
    public Binding fleetBusBinding() {
        return BindingBuilder.bind(fleetBusQueue())
                .to(fleetExchange()).with(FLEET_BUS_UPDATED_KEY);
    }

    @Bean
    public Binding voyageCancelledBinding() {
        return BindingBuilder.bind(voyageCancelledQueue())
                .to(bookingExchange()).with(VOYAGE_CANCELLED_KEY);
    }

    // ════════════════════════════════════════════════════════════════════════
    // SÉRIALISATION JSON
    // ════════════════════════════════════════════════════════════════════════

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

    // ════════════════════════════════════════════════════════════════════════
    // HELPERS
    // ════════════════════════════════════════════════════════════════════════

    /**
     * Queue durable AVEC DLX — pour les queues propres au booking-service.
     * Les messages rejetés partent vers njila.dead.letter.exchange.
     */
    private Queue durableQueueWithDLX(String name) {
        return QueueBuilder.durable(name)
                .withArgument("x-dead-letter-exchange",    EXCHANGE_DEAD_LETTER)
                .withArgument("x-dead-letter-routing-key", DEAD_LETTER_KEY)
                .build();
    }
}
