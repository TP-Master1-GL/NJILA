package com.njila.njila_payement_service.infrastructure.webhook;

import com.njila.njila_payement_service.application.services.interfaces.IdempotencyService;
import com.njila.njila_payement_service.application.services.interfaces.PaymentService;
import lombok.RequiredArgsConstructor;

@RequiredArgsConstructor

public class WebHookHandler {

    private final PaymentService paymentService;

    private final IdempotencyService idempotencyService;


}
