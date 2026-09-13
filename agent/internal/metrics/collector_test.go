package metrics_test

import (
	"context"
	"testing"
	"time"

	"github.com/pulsegrid/agent/internal/metrics"
)

func TestCollectEnvelopeBasics(t *testing.T) {
	c := metrics.NewCollector("test-01")
	resp, err := c.Collect(context.Background())
	if err != nil {
		t.Fatalf("Collect: %v", err)
	}
	if resp.ServerId != "test-01" {
		t.Fatalf("ServerId = %q", resp.ServerId)
	}
	if resp.Sequence == 0 {
		t.Fatal("Sequence is zero")
	}
	if resp.CollectedAtUnixMs == 0 {
		t.Fatal("CollectedAtUnixMs is zero")
	}
	if resp.Cpu == nil || resp.Memory == nil || resp.Host == nil || resp.Agent == nil {
		t.Fatal("missing nested metrics")
	}
	if resp.Cpu.LogicalCores == 0 && len(resp.Cpu.PerCorePercent) == 0 {
		t.Fatal("expected logical cores or per-core samples")
	}
	if resp.Memory.TotalMb <= 0 {
		t.Fatalf("TotalMb = %v", resp.Memory.TotalMb)
	}
	// Second sample so rates can compute (may still be 0 on quiet interfaces).
	time.Sleep(50 * time.Millisecond)
	resp2, err := c.Collect(context.Background())
	if err != nil {
		t.Fatalf("Collect2: %v", err)
	}
	if resp2.Sequence <= resp.Sequence {
		t.Fatalf("sequence did not increase: %d -> %d", resp.Sequence, resp2.Sequence)
	}
}

func TestPerSecViaSecondCollect(t *testing.T) {
	c := metrics.NewCollector("test-01")
	_, _ = c.Collect(context.Background())
	time.Sleep(100 * time.Millisecond)
	env, err := c.Collect(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if len(env.Networks) == 0 && len(env.Disks) == 0 {
		t.Fatal("expected disks or networks")
	}
}
