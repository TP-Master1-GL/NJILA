FROM eclipse-temurin:17-jre-alpine



WORKDIR /tmp
ADD target/njila-registry-service.jar njila-registry-service.jar

ENTRYPOINT ["java", "-jar", "njila-registry-service.jar"]