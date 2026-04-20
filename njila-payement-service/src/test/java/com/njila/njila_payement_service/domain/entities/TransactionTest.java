package com.njila.njila_payement_service.domain.entities;


import com.njila.njila_payement_service.domain.enumerations.TransactionStatus;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.*;

public class TransactionTest {

    @Test
    void authorize_method_should_change_INITIATED_TO_AUTHORIZED(){

        Transaction transaction = new Transaction(TransactionStatus.INITIATED);

        transaction.authorize();

        assertThat(transaction.getStatus()).isEqualTo(TransactionStatus.AUTHORIZED);

    }

    @Test
    void markSucceed_method_should_change_AUTHORIZED_TO_SUCCEEDED(){

        Transaction transaction = new Transaction(TransactionStatus.AUTHORIZED);

        transaction.markSucceed();

        assertThat(transaction.getStatus()).isEqualTo(TransactionStatus.CAPTURED);
    }

    @Test
    void markFailed_method_should_change_INITIATED_TO_FAILED(){

        Transaction transaction = new Transaction(TransactionStatus.INITIATED);

        transaction.markFailed();

        assertThat(transaction.getStatus()).isEqualTo(TransactionStatus.FAILED);
    }

    @Test
    void complete_method_should_change_AUTHORIZED_TO_REVERSED(){

        Transaction transaction = new Transaction(TransactionStatus.AUTHORIZED);

        transaction.complete();

        assertThat(transaction.getStatus()).isEqualTo(TransactionStatus.REVERSED);
    }

    @Test
    void timeout_method_should_change_AUTHORIZED_TO_TIMEOUT(){

        Transaction transaction = new Transaction(TransactionStatus.AUTHORIZED);

        transaction.timeout();

        assertThat(transaction.getStatus()).isEqualTo(TransactionStatus.TIMEOUT);
    }
}
