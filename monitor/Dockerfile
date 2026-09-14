# syntax=docker/dockerfile:1
# Unified Pulsegrid Monitor: Spring Boot API/WS/Gateway + static Next.js UI (one container).
# Build from repo root: docker build -f monitor/Dockerfile -t pulsegrid-monitor .

FROM node:22-bookworm AS ui
WORKDIR /ui
COPY dashboard/package.json dashboard/package-lock.json ./
RUN npm ci
COPY dashboard/ ./
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM eclipse-temurin:21-jdk-jammy AS backend
WORKDIR /src
COPY backend/ ./
RUN chmod +x gradlew && ./gradlew bootJar --no-daemon

FROM eclipse-temurin:21-jre-jammy
WORKDIR /app
COPY --from=backend /src/build/libs/*.jar /app/app.jar
COPY --from=ui /ui/out /app/ui
ENV PULSEGRID_UI_DIR=file:/app/ui/
ENV PULSEGRID_SAME_ORIGIN=true
EXPOSE 8080 50051
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
