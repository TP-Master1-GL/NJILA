package com.njila.njila_payement_service.infracstructure.config;


import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;


@Configuration

public class RegisConfig {

    @Bean
    public RedisConnectionFactory stringRedisTemplate(RedisConnectionFactory connectionFactory) {

            return new LettuceConnectionFactory();

    }
}
