package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/pulsegrid/agent/internal/gateway"
	"github.com/pulsegrid/agent/internal/metrics"
)

func main() {
	cfg := gateway.Config{
		ServerID:       os.Getenv("SERVER_ID"),
		MonitorAddress: os.Getenv("MONITOR_ADDRESS"),
		JoinToken:      os.Getenv("JOIN_TOKEN"),
		CAFile:         os.Getenv("MONITOR_CA_FILE"),
	}
	if cfg.ServerID == "" {
		log.Fatal("SERVER_ID is required")
	}
	if cfg.MonitorAddress == "" {
		log.Fatal("MONITOR_ADDRESS is required (e.g. 192.168.150.10:50051)")
	}
	if cfg.CAFile == "" {
		log.Fatal("MONITOR_CA_FILE is required")
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	collector := metrics.NewCollector(cfg.ServerID)
	log.Printf("pulsegrid-agent %q v%s → monitor %s", cfg.ServerID, metrics.AgentVersion, cfg.MonitorAddress)
	if err := gateway.Run(ctx, cfg, collector); err != nil && ctx.Err() == nil {
		log.Fatal(err)
	}
}
