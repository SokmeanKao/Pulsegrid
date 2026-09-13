# syntax=docker/dockerfile:1
FROM golang:1.22-bookworm AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /pulsegrid-agent ./cmd/pulsegrid-agent

FROM gcr.io/distroless/static-debian12
COPY --from=build /pulsegrid-agent /pulsegrid-agent
ENV PORT=50051
EXPOSE 50051
ENTRYPOINT ["/pulsegrid-agent"]
