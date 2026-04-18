FROM eclipse-temurin:17-jre-alpine


WORKDIR /tmp
ADD target/njila-payement-service.jar njila-payement-service.jar

ENTRYPOINT ["java", "-jar", "njila-payement-service.jar"]