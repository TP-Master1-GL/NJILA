package com.njila.njila_conf_service;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.config.server.EnableConfigServer;

@SpringBootApplication
@EnableConfigServer
public class NjilaConfServiceApplication {

	public static void main(String[] args) {
		SpringApplication.run(NjilaConfServiceApplication.class, args);
	}

}
