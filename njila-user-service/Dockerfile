FROM eclipse-temurin:17-jre-alpine



WORKDIR /tmp
ADD target/njila-user-service.jar njila-user-service.jar

ENTRYPOINT ["java", "-jar", "njila-user-service.jar"]