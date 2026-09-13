# syntax=docker/dockerfile:1
FROM golang:1.22-bookworm AS build
ARG VERSION=2.0.0
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build \
  -ldflags="-s -w -X github.com/pulsegrid/agent/internal/metrics.AgentVersion=${VERSION}" \
  -o /pulsegrid-agent ./cmd/pulsegrid-agent

FROM gcr.io/distroless/static-debian12
COPY --from=build /pulsegrid-agent /pulsegrid-agent
USER nonroot:nonroot
ENTRYPOINT ["/pulsegrid-agent"]
