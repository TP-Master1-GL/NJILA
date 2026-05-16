package com.njila.njila_payement_service.application.dtos.responses;

import com.njila.njila_payement_service.domain.enumerations.PaymentStatus;
import com.njila.njila_payement_service.domain.enumerations.TransactionStatus;

public record PaymentStatusResponse(

        long paymentId,

        PaymentStatus status,

        TransactionStatus Transactionstatus
){}
