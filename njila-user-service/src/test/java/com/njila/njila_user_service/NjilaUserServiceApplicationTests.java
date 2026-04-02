package com.njila.njila_user_service;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

@SpringBootTest
@ActiveProfiles("test")
@TestPropertySource(locations = "classpath:application-test.properties")
class NjilaUserServiceApplicationTests {

    @Test
    void contextLoads() {
        // Verifie que le contexte Spring Boot demarre correctement
    }
}