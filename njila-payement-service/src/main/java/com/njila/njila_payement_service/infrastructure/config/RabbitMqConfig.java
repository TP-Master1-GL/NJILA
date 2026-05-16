package com.njila.njila_payement_service.infrastructure.config;

import org.springframework.amqp.core.*;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitMqConfig {

    // ── Exchanges ─────────────────────────────────────────────────────────────
    public static final String EXCHANGE              = "njila.payment.exchange";
    public static final String EXCHANGE_DEAD_LETTER  = "njila.dead.letter.exchange";
    public static final String DEAD_LETTER_KEY       = "dead.letter";

    // ── Routing keys entrantes ────────────────────────────────────────────────
    public static final String BOOKING_CREATED          = "booking.created";
    public static final String BOOKING_REFUND_REQUESTED = "booking.refund.requested";

    // ── Routing keys sortantes ────────────────────────────────────────────────
    public static final String PAYMENT_COMPLETED = "payment.succeed";
    public static final String PAYMENT_FAILED    = "payment.failed";
    public static final String PAYMENT_REFUNDED  = "payment.refunded";
    public static final String PAYMENT_CANCELLED = "payment.cancelled";
    public static final String PAYMENT_INITIATED = "payment.initiated";
    public static final String PAYMENT_TIMEOUT   = "payment.timeout";

    // ── Noms des queues entrantes ─────────────────────────────────────────────
    public static final String BOOKING_CREATED_QUEUE          = "njila.payment.booking.created.queue";
    public static final String BOOKING_REFUND_REQUESTED_QUEUE = "njila.payment.refund.requested.queue";

    // ── Noms des queues sortantes ─────────────────────────────────────────────
    public static final String PAYMENT_SUCCESS_QUEUE = "njila.payment.success.queue";
    public static final String PAYMENT_FAIL_QUEUE    = "njila.payment.fail.queue";
    public static final String NOTIF_SUCCESS_QUEUE   = "njila.payment.success.notif.queue";
    public static final String NOTIF_FAIL_QUEUE      = "njila.payment.fail.notif.queue";
    public static final String REFUND_QUEUE          = "njila.payment.refunded.queue";
    public static final String CANCELLED_QUEUE       = "njila.payment.canceled.queue";
    public static final String INITIATED_QUEUE       = "njila.payment.initiated.queue";
    public static final String TIMEOUT_QUEUE         = "njila.payment.timeout.queue";

    // ── Noms des Dead Letter Queues (DLQ) ────────────────────────────────────
    public static final String BOOKING_CREATED_DLQ          = "njila.payment.booking.created.dlq";
    public static final String BOOKING_REFUND_REQUESTED_DLQ = "njila.payment.refund.requested.dlq";
    public static final String DEAD_LETTER_QUEUE            = "njila.payment.dead.letter.queue";

    // ════════════════════════════════════════════════════════════════════════
    // EXCHANGES
    // ════════════════════════════════════════════════════════════════════════

    @Bean
    public TopicExchange exchange() {
        return ExchangeBuilder.topicExchange(EXCHANGE).durable(true).build();
    }

    @Bean
    public DirectExchange deadLetterExchange() {
        return ExchangeBuilder.directExchange(EXCHANGE_DEAD_LETTER).durable(true).build();
    }

    // ════════════════════════════════════════════════════════════════════════
    // DEAD LETTER QUEUES — reçoivent les messages en erreur irrécupérable
    // ════════════════════════════════════════════════════════════════════════

    /**
     * DLQ générique (héritée de l'ancienne config)
     */
    @Bean
    public Queue deadLetterQueue() {
        return QueueBuilder.durable(DEAD_LETTER_QUEUE).build();
    }

    @Bean
    public Binding deadLetterBinding() {
        return BindingBuilder.bind(deadLetterQueue())
                .to(deadLetterExchange())
                .with(DEAD_LETTER_KEY);
    }

    /**
     * DLQ dédiée à booking.created
     * Reçoit les messages qui échouent définitivement dans bookingCreatedQueue
     */
    @Bean
    public Queue bookingCreatedDlq() {
        return QueueBuilder.durable(BOOKING_CREATED_DLQ).build();
    }

    @Bean
    public Binding bookingCreatedDlqBinding() {
        return BindingBuilder.bind(bookingCreatedDlq())
                .to(deadLetterExchange())
                .with(BOOKING_CREATED_DLQ);
    }

    /**
     * DLQ dédiée à booking.refund.requested
     */
    @Bean
    public Queue bookingRefundRequestedDlq() {
        return QueueBuilder.durable(BOOKING_REFUND_REQUESTED_DLQ).build();
    }

    @Bean
    public Binding bookingRefundRequestedDlqBinding() {
        return BindingBuilder.bind(bookingRefundRequestedDlq())
                .to(deadLetterExchange())
                .with(BOOKING_REFUND_REQUESTED_DLQ);
    }

    // ════════════════════════════════════════════════════════════════════════
    // QUEUES ENTRANTES — avec DLX pour casser la boucle infinie
    // Si le listener lève une exception non catchée, le message part en DLQ
    // au lieu d'être requeué indéfiniment
    // ════════════════════════════════════════════════════════════════════════

    @Bean
    public Queue bookingCreatedQueue() {
        return QueueBuilder.durable(BOOKING_CREATED_QUEUE)
                .withArgument("x-dead-letter-exchange",    EXCHANGE_DEAD_LETTER)
                .withArgument("x-dead-letter-routing-key", BOOKING_CREATED_DLQ)
                .build();
    }

    @Bean
    public Queue bookingRefundRequestedQueue() {
        return QueueBuilder.durable(BOOKING_REFUND_REQUESTED_QUEUE)
                .withArgument("x-dead-letter-exchange",    EXCHANGE_DEAD_LETTER)
                .withArgument("x-dead-letter-routing-key", BOOKING_REFUND_REQUESTED_DLQ)
                .build();
    }

    // ════════════════════════════════════════════════════════════════════════
    // QUEUES SORTANTES — inchangées (pas besoin de DLX)
    // ════════════════════════════════════════════════════════════════════════

    @Bean public Queue paymentSuccessQueue()      { return durableQueue(PAYMENT_SUCCESS_QUEUE); }
    @Bean public Queue paymentFailQueue()         { return durableQueue(PAYMENT_FAIL_QUEUE); }
    @Bean public Queue notificationSuccessQueue() { return durableQueue(NOTIF_SUCCESS_QUEUE); }
    @Bean public Queue notificationFailQueue()    { return durableQueue(NOTIF_FAIL_QUEUE); }
    @Bean public Queue refundedQueue()            { return durableQueue(REFUND_QUEUE); }
    @Bean public Queue cancelledQueue()           { return durableQueue(CANCELLED_QUEUE); }
    @Bean public Queue initiatedQueue()           { return durableQueue(INITIATED_QUEUE); }
    @Bean public Queue timeoutQueue()             { return durableQueue(TIMEOUT_QUEUE); }

    // ════════════════════════════════════════════════════════════════════════
    // BINDINGS ENTRANTS
    // ════════════════════════════════════════════════════════════════════════

    @Bean
    public Binding bookingCreatedBinding() {
        return BindingBuilder.bind(bookingCreatedQueue())
                .to(exchange()).with(BOOKING_CREATED);
    }

    @Bean
    public Binding bookingRefundRequestedBinding() {
        return BindingBuilder.bind(bookingRefundRequestedQueue())
                .to(exchange()).with(BOOKING_REFUND_REQUESTED);
    }

    // ════════════════════════════════════════════════════════════════════════
    // BINDINGS SORTANTS
    // ════════════════════════════════════════════════════════════════════════

    @Bean
    public Binding paymentSuccessBinding() {
        return BindingBuilder.bind(paymentSuccessQueue())
                .to(exchange()).with(PAYMENT_COMPLETED);
    }

    @Bean
    public Binding paymentFailBinding() {
        return BindingBuilder.bind(paymentFailQueue())
                .to(exchange()).with(PAYMENT_FAILED);
    }

    @Bean
    public Binding notificationSuccessBinding() {
        return BindingBuilder.bind(notificationSuccessQueue())
                .to(exchange()).with(PAYMENT_COMPLETED);
    }

    @Bean
    public Binding notificationFailBinding() {
        return BindingBuilder.bind(notificationFailQueue())
                .to(exchange()).with(PAYMENT_FAILED);
    }

    @Bean
    public Binding paymentRefundedBinding() {
        return BindingBuilder.bind(refundedQueue())
                .to(exchange()).with(PAYMENT_REFUNDED);
    }

    @Bean
    public Binding paymentCancelledBinding() {
        return BindingBuilder.bind(cancelledQueue())
                .to(exchange()).with(PAYMENT_CANCELLED);
    }

    @Bean
    public Binding paymentInitiatedBinding() {
        return BindingBuilder.bind(initiatedQueue())
                .to(exchange()).with(PAYMENT_INITIATED);
    }

    @Bean
    public Binding paymentTimeoutBinding() {
        return BindingBuilder.bind(timeoutQueue())
                .to(exchange()).with(PAYMENT_TIMEOUT);
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
    // HELPER
    // ════════════════════════════════════════════════════════════════════════

    /**
     * Queue durable simple, sans DLX.
     * Utilisée pour toutes les queues sortantes qui n'ont pas besoin
     * de protection contre la boucle infinie.
     */
    private Queue durableQueue(String name) {
        return QueueBuilder.durable(name).build();
    }
}
