package com.njila.njila_payement_service.infrastructure.config;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration

public class RabbitMqConfig {


    public static final String EXCHANGE = "njila.payment.exchange";


    //Queues

    //event listened queue
    public static final String BOOKING_CREATED_QUEUE = "njila.booking.created.queue";

    //Event published queues

    public static final String PAYMENT_SUCCESS_QUEUE = "njila.payment.success.queue";

    public static final String PAYMENT_FAIL_QUEUE = "njila.payment.fail.queue";

    public static final String REFUND_QUEUE = "njila.payment.refunded.queue";

    public static final String CANCELLED_QUEUE = "njila.payment.canceled.queue";


    public static final String NOTIF_SUCCESS_QUEUE = "njila.payment.success.notif.queue";

    public static final String NOTIF_FAIL_QUEUE = "njila.payment.fail.notif.queue";


    public static final String INITIATED_QUEUE = "njila.payment.initiated.queue";

    public static final String TIMEOUT_QUEUE = "njila.payment.timeout.queue";



    //Routing keys
    public static final String PAYMENT_COMPLETED = "payment.succeed";

    public static final String PAYMENT_FAILED = "payment.failed";

    public static final String PAYMENT_REFUNDED = "payment.refunded";

    public static final String PAYMENT_CANCELLED = "payment.cancelled";

    public static final String PAYMENT_INITIATED = "payment.initiated";

    public static final String PAYMENT_TIMEOUT = "payment.timeout";

    public static final String BOOKING_CREATED = "booking.created";




    @Bean
    public TopicExchange exchange() {

        return new TopicExchange(EXCHANGE);
    }

    @Bean
    public Queue paymentSuccessQueue() {
        return new Queue(PAYMENT_SUCCESS_QUEUE);
    }

    @Bean
    public Queue paymentFailQueue() {
        return new Queue(PAYMENT_FAIL_QUEUE);
    }

    @Bean
    public Queue refundedQueue() {
        return new Queue(REFUND_QUEUE);
    }

    @Bean
    public Queue cancelledQueue() {
        return new  Queue(CANCELLED_QUEUE);
    }

    @Bean
    public Queue bookingCreated() {
        return new Queue(BOOKING_CREATED_QUEUE);
    }

    @Bean
    public Queue notificationSuccessQueue() {
        return new Queue(NOTIF_SUCCESS_QUEUE);
    }

    @Bean
    public Queue notificationFailQueue() {
        return new Queue(NOTIF_FAIL_QUEUE);
    }



    @Bean
    public Queue initiatedQueue() {
        return new  Queue(INITIATED_QUEUE);
    }



    @Bean
    public Queue timeoutQueue() {
        return new  Queue(TIMEOUT_QUEUE);
    }


    @Bean
    public Binding PaymentSuccessBinding() {
        return BindingBuilder
                .bind(paymentSuccessQueue())
                .to(exchange())
                .with(PAYMENT_COMPLETED);
    }

    @Bean
    public Binding PaymentFailBinding() {
        return BindingBuilder
                .bind(paymentFailQueue())
                .to(exchange())
                .with(PAYMENT_FAILED);
    }

    @Bean
    public Binding PaymentRefundBinding() {
        return BindingBuilder
                .bind(refundedQueue())
                .to(exchange())
                .with(PAYMENT_REFUNDED);
    }

    @Bean
    public Binding PaymentCancelledBinding() {
        return BindingBuilder
                .bind(cancelledQueue())
                .to(exchange())
                .with(PAYMENT_CANCELLED);
    }

    @Bean
    public Binding BookingCreatedBinding() {
        return BindingBuilder
                .bind(bookingCreated())
                .to(exchange())
                .with(BOOKING_CREATED);
    }


    @Bean
    public Binding PaymentInitiatedBinding() {
        return BindingBuilder
                .bind(initiatedQueue())
                .to(exchange())
                .with(PAYMENT_INITIATED);
    }

    @Bean
    public Binding PaymentTimeoutBinding() {
        return BindingBuilder
                .bind(timeoutQueue())
                .to(exchange())
                .with(PAYMENT_TIMEOUT);
    }



    @Bean
    public Jackson2JsonMessageConverter messageConverter() {
        return new Jackson2JsonMessageConverter();
    }
}
