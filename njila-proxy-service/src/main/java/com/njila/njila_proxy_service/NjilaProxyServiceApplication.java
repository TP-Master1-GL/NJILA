package com.njila.njila_proxy_service;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;

@SpringBootApplication
@EnableDiscoveryClient
public class NjilaProxyServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(NjilaProxyServiceApplication.class, args);
    }
}