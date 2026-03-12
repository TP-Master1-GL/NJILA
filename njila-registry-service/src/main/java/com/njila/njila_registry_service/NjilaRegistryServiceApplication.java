package com.njila.njila_registry_service;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.netflix.eureka.server.EnableEurekaServer;

@SpringBootApplication
@EnableEurekaServer
public class NjilaRegistryServiceApplication {

	public static void main(String[] args) {
		SpringApplication.run(NjilaRegistryServiceApplication.class, args);
	}

}
