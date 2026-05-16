package com.njila.njila_payement_service.infrastructure.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;

@Configuration
@EnableAsync
public class AsyncConfig {

    /**
     * Pool de threads dédié au polling Campay.
     * corePoolSize  = 5  → 5 paiements simultanés
     * maxPoolSize   = 20 → pic jusqu'à 20
     * queueCapacity = 50 → file d'attente si pool saturé
     */
    @Bean(name = "campayPollingExecutor")
    public Executor campayPollingExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(5);
        executor.setMaxPoolSize(20);
        executor.setQueueCapacity(50);
        executor.setThreadNamePrefix("campay-poll-");
        executor.initialize();
        return executor;
    }
}
