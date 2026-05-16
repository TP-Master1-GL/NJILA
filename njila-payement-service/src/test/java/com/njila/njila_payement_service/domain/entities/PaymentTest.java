package com.njila.njila_payement_service.domain.entities;

import com.njila.njila_payement_service.domain.enumerations.PaymentStatus;
import com.njila.njila_payement_service.domain.exceptions.InvalidPaymentTransitionException;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.*;

public class PaymentTest {

    // These tests are to ensure that payment transition correctly

    @Test
    void cancel_method_should_change_pending_to_cancel(){

        Payment payment = new Payment(PaymentStatus.PENDING);

        payment.cancel();

        assertThat(payment.getStatus().equals(PaymentStatus.CANCELLED));
    }

    @Test
    void cancel_method_should_change_processing_to_cancel(){

        Payment payment = new Payment(PaymentStatus.PROCESSING);

        payment.cancel();

        assertThat(payment.getStatus().equals(PaymentStatus.CANCELLED));
    }

    @Test
    void confirm_method_should_change_processing_to_completed(){

        Payment payment = new Payment(PaymentStatus.PROCESSING);

        payment.confirm();

        assertThat(payment.getStatus().equals(PaymentStatus.COMPLETED));
    }

    @Test
    void initiate_method_should_change_pending_to_processing(){

        Payment payment = new Payment(PaymentStatus.PENDING);

        payment.initiate();

        assertThat(payment.getStatus().equals(PaymentStatus.PROCESSING));
    }


    @Test
    void fail_method_should_change_processing_to_failed(){

        Payment payment = new Payment(PaymentStatus.PROCESSING);

        payment.fail();

        assertThat(payment.getStatus().equals(PaymentStatus.FAILED));
    }

    @Test
    void expire_method_should_change_processing_to_expired(){

        Payment payment = new Payment(PaymentStatus.PROCESSING);

        payment.expire();

        assertThat(payment.getStatus().equals(PaymentStatus.EXPIRED));

    }

    @Test
    void refund_method_should_change_complete_to_refunded(){

        Payment payment = new Payment(PaymentStatus.COMPLETED);

        payment.refund();

        assertThat(payment.getStatus().equals(PaymentStatus.REFUNDED));

    }

    @Test
    void refund_partially_method_should_change_complete_to_partially_refunded(){

        Payment payment = new Payment(PaymentStatus.COMPLETED);

        payment.refund();

        assertThat(payment.getStatus().equals(PaymentStatus.PARTIALLY_REFUNDED));

    }





    // These one are to ensure that an Exception will be thrown when invalid transition


    @Test
    void cancel_method_should_thrown_an_exception_if_payment_status_is_COMPLETED(){

        Payment payment = new Payment(PaymentStatus.COMPLETED);

        assertThatThrownBy(payment::cancel)
                .isInstanceOf(InvalidPaymentTransitionException.class)
                .hasMessageContaining("cancelled");
    }


    @Test
    void confirm_method_should_throw_an_exception_if_payment_status_is_invalid(){

        Payment payment = new Payment(PaymentStatus.EXPIRED);

        assertThatThrownBy(payment::confirm)
                .isInstanceOf(InvalidPaymentTransitionException.class)
                .hasMessageContaining("cannot");
    }

    @Test
    void initiate_method_should_thrown_exception_if_status_is_invalid(){

        Payment payment = new Payment(PaymentStatus.PARTIALLY_REFUNDED);

        assertThatThrownBy(payment::confirm)
                .isInstanceOf(InvalidPaymentTransitionException.class)
                .hasMessageContaining("cannot");

    }
}
