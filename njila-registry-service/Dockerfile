FROM eclipse-temurin:17-jre-alpine

# Installer curl pour les health checks
RUN apk add --no-cache curl

WORKDIR /tmp
ADD target/njila-registry-service.jar njila-registry-service.jar

ENTRYPOINT ["java", "-jar", "njila-registry-service.jar"]