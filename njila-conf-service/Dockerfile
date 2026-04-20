FROM eclipse-temurin:17-jre-alpine

WORKDIR /tmp
ADD target/njila-conf-service.jar njila-conf-service.jar

ENTRYPOINT ["java", "-jar", "njila-conf-service.jar"]