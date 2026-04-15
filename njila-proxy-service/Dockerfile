FROM eclipse-temurin:17-jre-alpine

# Installer curl pour les health checks
RUN apk add --no-cache curl

WORKDIR /tmp
ADD target/njila-proxy-service.jar njila-proxy-service.jar

ENTRYPOINT ["java", "-jar", "njila-proxy-service.jar"]