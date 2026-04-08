package com.njila.njila_booking_service.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI customOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("NJILA Booking Service API")
                        .version("1.0.0")
                        .description("Documentation interactive des API du service de réservation njila-booking-service. " +
                                "Permet de vérifier et tester les endpoints de création, annulation, validation de réservation, etc.")
                        .contact(new Contact().name("Équipe NJILA").email("support@njila.com")));
    }
}
