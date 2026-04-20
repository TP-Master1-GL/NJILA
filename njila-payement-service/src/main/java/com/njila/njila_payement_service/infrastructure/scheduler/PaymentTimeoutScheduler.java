package com.njila.njila_payement_service.infrastructure.scheduler;

import com.njila.njila_payement_service.application.services.interfaces.PaymentService;
import com.njila.njila_payement_service.domain.enumerations.PaymentStatus;
import com.njila.njila_payement_service.infrastructure.repositories.PaymentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Component

@RequiredArgsConstructor

public class PaymentTimeoutScheduler {

    private final PaymentService paymentService;

    private final PaymentRepository paymentRepository;

    @Scheduled(fixedRate = 30000)
    public void checkTimeouts(){

        LocalDateTime limit = LocalDateTime.now().minusMinutes(10);

        paymentRepository.findByStatusAndUpdatedAtBefore(
                PaymentStatus.PROCESSING,
                limit
        )
                .forEach(payment -> paymentService.paymentTimeout(payment.getPaymentId())
                );
    }
}
