package server

import (
	"context"
	"log"
	"time"

	"github.com/pulsegrid/agent/internal/metrics"
	"github.com/pulsegrid/agent/internal/pb"
)

// PulsegridServer implements pb.PulsegridServiceServer.
type PulsegridServer struct {
	pb.UnimplementedPulsegridServiceServer
	Collector *metrics.Collector
}

func (s *PulsegridServer) GetMetrics(ctx context.Context, _ *pb.MetricsRequest) (*pb.MetricsEnvelope, error) {
	return s.Collector.Collect(ctx)
}

func (s *PulsegridServer) StreamMetrics(req *pb.MetricsRequest, stream pb.PulsegridService_StreamMetricsServer) error {
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	ctx := stream.Context()
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
			resp, err := s.Collector.Collect(ctx)
			if err != nil {
				log.Printf("collect metrics: %v", err)
				continue
			}
			if err := stream.Send(resp); err != nil {
				return err
			}
		}
	}
}

func (s *PulsegridServer) HealthCheck(context.Context, *pb.HealthRequest) (*pb.HealthResponse, error) {
	return &pb.HealthResponse{
		Status:  "OK",
		Message: "agent healthy",
	}, nil
}
