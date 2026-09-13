package main

import (
	"log"
	"net"
	"os"

	"github.com/pulsegrid/agent/internal/metrics"
	"github.com/pulsegrid/agent/internal/pb"
	"github.com/pulsegrid/agent/internal/server"
	"google.golang.org/grpc"
	"google.golang.org/grpc/reflection"
)

func main() {
	serverID := os.Getenv("SERVER_ID")
	if serverID == "" {
		log.Fatal("SERVER_ID is required")
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "50051"
	}

	lis, err := net.Listen("tcp", ":"+port)
	if err != nil {
		log.Fatalf("listen: %v", err)
	}

	collector := metrics.NewCollector(serverID)
	grpcServer := grpc.NewServer()
	pb.RegisterPulsegridServiceServer(grpcServer, &server.PulsegridServer{Collector: collector})
	reflection.Register(grpcServer)

	log.Printf("pulsegrid-agent %q v%s listening on :%s", serverID, metrics.AgentVersion, port)
	if err := grpcServer.Serve(lis); err != nil {
		log.Fatalf("serve: %v", err)
	}
}
