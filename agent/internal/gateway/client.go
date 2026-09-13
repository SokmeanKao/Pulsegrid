package gateway

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"log"
	"os"
	"runtime"
	"time"

	"github.com/pulsegrid/agent/internal/metrics"
	"github.com/pulsegrid/agent/internal/pb"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
)

type Config struct {
	ServerID       string
	MonitorAddress string
	JoinToken      string
	CAFile         string
}

// Run dials the Monitor Agent Gateway forever with reconnect backoff.
func Run(ctx context.Context, cfg Config, collector *metrics.Collector) error {
	if cfg.ServerID == "" {
		return fmt.Errorf("SERVER_ID is required")
	}
	if cfg.MonitorAddress == "" {
		return fmt.Errorf("MONITOR_ADDRESS is required")
	}

	backoff := time.Second
	for {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		err := connectOnce(ctx, cfg, collector)
		if ctx.Err() != nil {
			return ctx.Err()
		}
		log.Printf("gateway disconnected: %v; retry in %s", err, backoff)
		timer := time.NewTimer(backoff)
		select {
		case <-ctx.Done():
			timer.Stop()
			return ctx.Err()
		case <-timer.C:
		}
		backoff = nextBackoff(backoff)
	}
}

func connectOnce(ctx context.Context, cfg Config, collector *metrics.Collector) error {
	creds, err := loadTLS(cfg.CAFile)
	if err != nil {
		return err
	}

	conn, err := grpc.NewClient(cfg.MonitorAddress, grpc.WithTransportCredentials(creds))
	if err != nil {
		return fmt.Errorf("dial: %w", err)
	}
	defer conn.Close()

	stream, err := pb.NewAgentGatewayClient(conn).Connect(ctx)
	if err != nil {
		return fmt.Errorf("connect: %w", err)
	}

	host, _ := os.Hostname()
	hello := &pb.AgentHello{
		ServerId:     cfg.ServerID,
		Hostname:     host,
		Os:           runtime.GOOS,
		Arch:         runtime.GOARCH,
		AgentVersion: metrics.AgentVersion,
		JoinToken:    cfg.JoinToken,
	}
	if err := stream.Send(&pb.AgentMessage{
		Payload: &pb.AgentMessage_Hello{Hello: hello},
	}); err != nil {
		return fmt.Errorf("send hello: %w", err)
	}

	msg, err := stream.Recv()
	if err != nil {
		return fmt.Errorf("recv welcome: %w", err)
	}
	switch p := msg.Payload.(type) {
	case *pb.MonitorMessage_Reject:
		return fmt.Errorf("rejected: %s (%s)", p.Reject.GetCode(), p.Reject.GetMessage())
	case *pb.MonitorMessage_Welcome:
		if !p.Welcome.GetAccepted() {
			return fmt.Errorf("welcome not accepted")
		}
		metricsEvery := time.Duration(p.Welcome.GetMetricsIntervalSeconds()) * time.Second
		if metricsEvery <= 0 {
			metricsEvery = 2 * time.Second
		}
		heartbeatEvery := time.Duration(p.Welcome.GetHeartbeatIntervalSeconds()) * time.Second
		if heartbeatEvery <= 0 {
			heartbeatEvery = 10 * time.Second
		}
		log.Printf("welcomed by monitor; metrics=%s heartbeat=%s", metricsEvery, heartbeatEvery)
		return streamLoop(ctx, stream, collector, metricsEvery, heartbeatEvery)
	default:
		return fmt.Errorf("unexpected first monitor message")
	}
}

func streamLoop(
	ctx context.Context,
	stream pb.AgentGateway_ConnectClient,
	collector *metrics.Collector,
	metricsEvery, heartbeatEvery time.Duration,
) error {
	metricsTick := time.NewTicker(metricsEvery)
	heartbeatTick := time.NewTicker(heartbeatEvery)
	defer metricsTick.Stop()
	defer heartbeatTick.Stop()

	errCh := make(chan error, 1)
	go func() {
		for {
			msg, err := stream.Recv()
			if err != nil {
				errCh <- err
				return
			}
			switch msg.Payload.(type) {
			case *pb.MonitorMessage_Reject:
				errCh <- fmt.Errorf("monitor rejected mid-stream")
				return
			default:
				// Config/command reserved for later
			}
		}
	}()

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case err := <-errCh:
			return err
		case <-metricsTick.C:
			env, err := collector.Collect(ctx)
			if err != nil {
				log.Printf("collect: %v", err)
				continue
			}
			if err := stream.Send(&pb.AgentMessage{
				Payload: &pb.AgentMessage_Metrics{Metrics: env},
			}); err != nil {
				return err
			}
		case <-heartbeatTick.C:
			if err := stream.Send(&pb.AgentMessage{
				Payload: &pb.AgentMessage_Heartbeat{Heartbeat: &pb.Heartbeat{
					UnixMs: time.Now().UnixMilli(),
				}},
			}); err != nil {
				return err
			}
		}
	}
}

func loadTLS(caFile string) (credentials.TransportCredentials, error) {
	if caFile == "" {
		return nil, fmt.Errorf("MONITOR_CA_FILE is required")
	}
	pem, err := os.ReadFile(caFile)
	if err != nil {
		return nil, fmt.Errorf("read CA: %w", err)
	}
	pool := x509.NewCertPool()
	if !pool.AppendCertsFromPEM(pem) {
		return nil, fmt.Errorf("invalid CA PEM in %s", caFile)
	}
	return credentials.NewTLS(&tls.Config{
		RootCAs:    pool,
		MinVersion: tls.VersionTLS12,
	}), nil
}
