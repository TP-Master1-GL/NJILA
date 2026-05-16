FROM eclipse-temurin:17-jre-alpine


WORKDIR /tmp
ADD target/njila-booking-service.jar njila-booking-service.jar

ENTRYPOINT ["java", "-jar", "njila-booking-service.jar"]