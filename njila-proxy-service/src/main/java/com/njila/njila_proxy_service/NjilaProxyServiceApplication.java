package com.njila.njila_proxy_service;

import com.njila.gateway.loadbalancer.NjangaLoadBalancerConfig;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;
import org.springframework.cloud.loadbalancer.annotation.LoadBalancerClient;
import org.springframework.cloud.loadbalancer.annotation.LoadBalancerClients;

@SpringBootApplication
@EnableDiscoveryClient
@LoadBalancerClients({
    @LoadBalancerClient(name = "NJILA-AUTH-SERVICE", configuration = NjangaLoadBalancerConfig.class),
    @LoadBalancerClient(name = "NJILA-USER-SERVICE", configuration = NjangaLoadBalancerConfig.class),
    @LoadBalancerClient(name = "NJILA-FLEET-SERVICE", configuration = NjangaLoadBalancerConfig.class),
    @LoadBalancerClient(name = "NJILA-BOOKING-SERVICE", configuration = NjangaLoadBalancerConfig.class),
    @LoadBalancerClient(name = "NJILA-PAYEMENT-SERVICE", configuration = NjangaLoadBalancerConfig.class),
    @LoadBalancerClient(name = "NJILA-NOTIFICATION-SERVICE", configuration = NjangaLoadBalancerConfig.class),
    @LoadBalancerClient(name = "NJILA-SUBSCRIBE-SERVICE", configuration = NjangaLoadBalancerConfig.class)
})
public class NjilaProxyServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(NjilaProxyServiceApplication.class, args);
    }
}
