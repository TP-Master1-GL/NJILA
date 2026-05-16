package com.njila.njila_user_service.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.servers.Server;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

@Configuration
public class SwaggerConfig {

    @Value("${spring.application.name:njila-user-service}")
    private String applicationName;

    @Bean
    public OpenAPI customOpenAPI() {
        return new OpenAPI()
            .info(new Info()
                .title("NJILA - User Service API")
                .description("""
                    Service de gestion des profils utilisateurs, staff et avis.
                    
                    ## Fonctionnalités principales
                    - **Gestion des profils** : consultation, modification, suppression
                    - **Gestion du staff** : création de guichetiers, chauffeurs, managers
                    - **Système d'avis** : soumission et consultation d'avis sur les agences
                    
                    ## Authentification
                    Les endpoints protégés nécessitent un token JWT Bearer.
                    Le token doit être fourni dans le header `Authorization: Bearer <token>`
                    
                    ## Rôles et permissions
                    - `VOYAGEUR` : peut consulter son profil, soumettre des avis
                    - `GUICHETIER` : accès limité aux opérations de guichet
                    - `MANAGER_LOCAL` : gestion des staff de sa filiale
                    - `MANAGER_GLOBAL` : gestion des staff de son agence
                    - `ADMINISTRATEUR` : accès complet à toutes les ressources
                    - `CHAUFFEUR` : gestion de son statut et voyages
                    """)
                .version("2.0.0")
                .contact(new Contact()
                    .name("NJILA Support")
                    .email("support@njila.com")
                    .url("https://njila.com"))
                .license(new License()
                    .name("Proprietary")
                    .url("https://njila.com/license")))
            .servers(List.of(
                new Server()
                    .url("http://localhost:8082")
                    .description("Development Server"),
                new Server()
                    .url("https://api.njila.com/user-service")
                    .description("Production Server")
            ))
            .addSecurityItem(new SecurityRequirement().addList("bearerAuth"))
            .components(new Components()
                .addSecuritySchemes("bearerAuth", new SecurityScheme()
                    .name("bearerAuth")
                    .type(SecurityScheme.Type.HTTP)
                    .scheme("bearer")
                    .bearerFormat("JWT")
                    .description("""
                        Entrez votre token JWT.
                        Format: `Bearer <votre-token-jwt>`
                        
                        Le token est généré par l'auth-service et contient :
                        - userId, role, sessionId, filialeId, agenceId
                        """)));
    }
}