package com.njila.njila_user_service.config;

import com.njila.njila_user_service.middleware.JwtMiddleware;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

/**
 * Configuration Spring Security - user-service.
 *
 * Routes publiques (sans JWT) :
 *   GET /api/users/health
 *   GET /api/avis/agence/**
 *   GET /actuator/**
 *   
 * Routes Swagger (sans JWT) :
 *   /swagger-ui/**
 *   /v3/api-docs/**
 *   /swagger-ui.html
 */
@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtMiddleware jwtMiddleware;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .csrf(AbstractHttpConfigurer::disable)
            .sessionManagement(sm ->
                sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS)
            )
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(
                    "/api/users/health",
                    "/api/avis/agence/**",
                    "/actuator/**",
                    "/swagger-ui/**",
                    "/swagger-ui.html",
                    "/v3/api-docs/**",
                    "/v3/api-docs"
                ).permitAll()
                .anyRequest().authenticated()
            )
            .addFilterBefore(jwtMiddleware, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}