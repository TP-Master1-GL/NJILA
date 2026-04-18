FROM eclipse-temurin:17-jre-alpine



WORKDIR /tmp
ADD target/njila-proxy-service.jar njila-proxy-service.jar

ENTRYPOINT ["java", "-jar", "njila-proxy-service.jar"]