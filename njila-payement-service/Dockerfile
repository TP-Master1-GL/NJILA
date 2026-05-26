# ──────────────────────────────────────────────────────────────
# Dockerfile multi-stage – njila-payement-service
# (Spring Boot)
# ──────────────────────────────────────────────────────────────

# ─── Stage 1 : Build ──────────────────────────────────────────
FROM eclipse-temurin:17-jdk-alpine AS builder
WORKDIR /workspace
COPY mvnw pom.xml ./
COPY .mvn .mvn
RUN ./mvnw dependency:go-offline -B --no-transfer-progress
COPY src src
RUN ./mvnw package -DskipTests -B --no-transfer-progress
RUN java -Djarmode=layertools -jar target/njila-payement-service.jar extract --destination target/extracted

# ─── Stage 2 : Runtime ────────────────────────────────────────
FROM eclipse-temurin:17-jre-alpine
RUN addgroup -S njila && adduser -S njila -G njila
WORKDIR /app
COPY --from=builder /workspace/target/extracted/dependencies/ ./
COPY --from=builder /workspace/target/extracted/spring-boot-loader/ ./
COPY --from=builder /workspace/target/extracted/snapshot-dependencies/ ./
COPY --from=builder /workspace/target/extracted/application/ ./
RUN chown -R njila:njila /app
USER njila
EXPOSE 8084
ENV JAVA_OPTS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0 -XX:+UseG1GC -Djava.security.egd=file:/dev/./urandom"
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS org.springframework.boot.loader.JarLauncher"]