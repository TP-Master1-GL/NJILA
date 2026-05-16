package com.njila.njila_booking_service;

import io.swagger.v3.oas.annotations.OpenAPIDefinition;
import io.swagger.v3.oas.annotations.info.Contact;
import io.swagger.v3.oas.annotations.info.Info;
import io.swagger.v3.oas.annotations.info.License;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
@OpenAPIDefinition(
		info = @Info(
				title = "NJILA Booking Service API",
				version = "1.0",
				description = "API de gestion des réservations pour la plateforme NJILA",
				contact = @Contact(name = "Support NJILA", email = "contact@njila.cm"),
				license = @License(name = "Proprietary", url = "https://www.njila.cm/terms/")
		)
)
public class NjilaBookingServiceApplication {

	public static void main(String[] args) {
		SpringApplication.run(NjilaBookingServiceApplication.class, args);
	}

}

