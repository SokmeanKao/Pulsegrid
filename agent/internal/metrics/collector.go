package metrics

import (
	"context"
	"fmt"
	"os"
	"runtime"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/pulsegrid/agent/internal/pb"
	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/host"
	"github.com/shirou/gopsutil/v3/load"
	"github.com/shirou/gopsutil/v3/mem"
	"github.com/shirou/gopsutil/v3/net"
)

// AgentVersion is the agent build version. Override at link time:
// go build -ldflags "-X github.com/pulsegrid/agent/internal/metrics.AgentVersion=1.3.0"
var AgentVersion = "2.1.1"

var (
	startedAt = time.Now()
	sequence  atomic.Uint64
	samples   atomic.Uint64
)

type ioSnapshot struct {
	at       time.Time
	net      map[string]net.IOCountersStat
	diskRead map[string]disk.IOCountersStat
	procIO   map[int32]procIOSnap
	procCPU  map[int32]float64 // cumulative process CPU seconds
	cpuAt    time.Time         // when procCPU was last sampled
}

type procIOSnap struct {
	read  uint64
	write uint64
}

type Collector struct {
	mu       sync.Mutex
	previous *ioSnapshot
	serverID string
	extras   extrasCache
	procScan procScanCache
}

type procScanCache struct {
	mu        sync.Mutex
	at        time.Time
	lights    []lightProc
	summary   *pb.ProcessSummary
	cpuTotals map[int32]float64
	enriched  []*pb.ProcessMetrics
	enrSum    *pb.ProcessSummary
}

const procScanTTL = 8 * time.Second

func NewCollector(serverID string) *Collector {
	return &Collector{serverID: serverID}
}

func (c *Collector) Collect(ctx context.Context) (*pb.MetricsEnvelope, error) {
	if c.serverID == "" {
		return nil, fmt.Errorf("serverID is required")
	}

	now := time.Now()
	seq := sequence.Add(1)
	sent := samples.Add(1)

	cpuPercents, err := cpu.PercentWithContext(ctx, 0, false)
	if err != nil {
		return nil, fmt.Errorf("cpu: %w", err)
	}
	cpuUsage := 0.0
	if len(cpuPercents) > 0 {
		cpuUsage = cpuPercents[0]
	}
	perCore, err := cpu.PercentWithContext(ctx, 0, true)
	if err != nil {
		perCore = nil
	}
	cores, _ := cpu.CountsWithContext(ctx, true)
	var load1, load5, load15 float64
	if avg, err := load.AvgWithContext(ctx); err == nil && avg != nil {
		load1, load5, load15 = avg.Load1, avg.Load5, avg.Load15
	}

	vm, err := mem.VirtualMemoryWithContext(ctx)
	if err != nil {
		return nil, fmt.Errorf("memory: %w", err)
	}
	swap, _ := mem.SwapMemoryWithContext(ctx)
	var swapTotal, swapUsed float64
	if swap != nil {
		swapTotal = float64(swap.Total) / (1024 * 1024)
		swapUsed = float64(swap.Used) / (1024 * 1024)
	}

	hostname, _ := os.Hostname()
	platform := runtime.GOOS
	if hi, err := host.InfoWithContext(ctx); err == nil && hi != nil {
		if hi.Hostname != "" {
			hostname = hi.Hostname
		}
		if hi.Platform != "" {
			platform = hi.Platform
		}
	}

	netCounters, err := net.IOCountersWithContext(ctx, true)
	if err != nil {
		return nil, fmt.Errorf("network: %w", err)
	}
	diskCounters, _ := disk.IOCountersWithContext(ctx)
	partitions, _ := disk.PartitionsWithContext(ctx, false)

	c.mu.Lock()
	prev := c.previous
	elapsed := 0.0
	if prev != nil {
		elapsed = now.Sub(prev.at).Seconds()
	}
	netMap := make(map[string]net.IOCountersStat, len(netCounters))
	for _, n := range netCounters {
		netMap[n.Name] = n
	}
	diskMap := make(map[string]disk.IOCountersStat, len(diskCounters))
	for name, d := range diskCounters {
		diskMap[name] = d
	}
	c.previous = &ioSnapshot{
		at:       now,
		net:      netMap,
		diskRead: diskMap,
		procIO:   map[int32]procIOSnap{},
		procCPU:  map[int32]float64{},
	}
	c.mu.Unlock()

	networks := make([]*pb.NetworkMetrics, 0, len(netCounters))
	for _, n := range netCounters {
		m := &pb.NetworkMetrics{
			InterfaceName: n.Name,
			RxErrors:      n.Errin,
			TxErrors:      n.Errout,
			RxDropped:     n.Dropin,
			TxDropped:     n.Dropout,
			RxBytesTotal:  n.BytesRecv,
			TxBytesTotal:  n.BytesSent,
		}
		if prev != nil && elapsed > 0 {
			if p, ok := prev.net[n.Name]; ok {
				m.RxBytesPerSec = perSec(n.BytesRecv, p.BytesRecv, elapsed)
				m.TxBytesPerSec = perSec(n.BytesSent, p.BytesSent, elapsed)
				m.RxPacketsPerSec = perSec(n.PacketsRecv, p.PacketsRecv, elapsed)
				m.TxPacketsPerSec = perSec(n.PacketsSent, p.PacketsSent, elapsed)
			}
		}
		networks = append(networks, m)
	}

	disks := make([]*pb.DiskMetrics, 0, len(partitions))
	seenMounts := map[string]struct{}{}
	for _, p := range partitions {
		if p.Mountpoint == "" {
			continue
		}
		if _, ok := seenMounts[p.Mountpoint]; ok {
			continue
		}
		seenMounts[p.Mountpoint] = struct{}{}
		usage, err := disk.UsageWithContext(ctx, p.Mountpoint)
		if err != nil {
			continue
		}
		dm := &pb.DiskMetrics{
			Mount:   p.Mountpoint,
			Device:  p.Device,
			UsedGb:  float64(usage.Used) / (1024 * 1024 * 1024),
			TotalGb: float64(usage.Total) / (1024 * 1024 * 1024),
		}
		if prev != nil && elapsed > 0 {
			if d, ok := diskMap[p.Device]; ok {
				if pd, ok := prev.diskRead[p.Device]; ok {
					dm.ReadBytesPerSec = perSec(d.ReadBytes, pd.ReadBytes, elapsed)
					dm.WriteBytesPerSec = perSec(d.WriteBytes, pd.WriteBytes, elapsed)
					dm.ReadOpsPerSec = perSec(d.ReadCount, pd.ReadCount, elapsed)
					dm.WriteOpsPerSec = perSec(d.WriteCount, pd.WriteCount, elapsed)
				}
			}
		}
		disks = append(disks, dm)
	}
	if len(disks) == 0 {
		root := "/"
		if runtime.GOOS == "windows" {
			root = "C:\\"
		}
		if usage, err := disk.UsageWithContext(ctx, root); err == nil {
			disks = append(disks, &pb.DiskMetrics{
				Mount:   root,
				Device:  root,
				UsedGb:  float64(usage.Used) / (1024 * 1024 * 1024),
				TotalGb: float64(usage.Total) / (1024 * 1024 * 1024),
			})
		}
	}

	top, summary, _ := c.collectProcesses(ctx, prev, elapsed)

	hostExtras := collectHostExtras(ctx)
	docker := c.dockerSummary(ctx, now)
	sensors := c.sensorsSummary(ctx, now)

	return &pb.MetricsEnvelope{
		ServerId:           c.serverID,
		CollectedAtUnixMs:  now.UnixMilli(),
		Sequence:           seq,
		Host: &pb.HostInfo{
			Hostname: hostname,
			Os:       runtime.GOOS,
			Arch:     runtime.GOARCH,
			Platform: platform,
		},
		Cpu: &pb.CpuMetrics{
			UsagePercent:   cpuUsage,
			LogicalCores:   uint32(cores),
			Load1:          load1,
			Load5:          load5,
			Load15:         load15,
			PerCorePercent: perCore,
		},
		Memory: &pb.MemoryMetrics{
			TotalMb:     float64(vm.Total) / (1024 * 1024),
			UsedMb:      float64(vm.Used) / (1024 * 1024),
			AvailableMb: float64(vm.Available) / (1024 * 1024),
			CachedMb:    float64(vm.Cached) / (1024 * 1024),
			SwapTotalMb: swapTotal,
			SwapUsedMb:  swapUsed,
		},
		Disks:          disks,
		Networks:       networks,
		TopProcesses:   top,
		ProcessSummary: summary,
		HostExtras:     hostExtras,
		Docker:         docker,
		Sensors:        sensors,
		Agent: &pb.AgentInfo{
			Version:         AgentVersion,
			GoVersion:       runtime.Version(),
			StartedAtUnixMs: startedAt.UnixMilli(),
			SamplesSent:     sent,
		},
	}, nil
}

func normalizeState(raw string) string {
	s := strings.ToLower(strings.TrimSpace(raw))
	switch {
	case strings.Contains(s, "run"):
		return "RUNNING"
	case strings.Contains(s, "zom") || s == "z":
		return "ZOMBIE"
	case strings.Contains(s, "stop") || s == "t":
		return "STOPPED"
	case strings.Contains(s, "idle"):
		return "IDLE"
	case strings.Contains(s, "sleep") || s == "s" || s == "sl":
		return "SLEEPING"
	case s == "" || s == "unknown":
		return "UNKNOWN"
	default:
		return "OTHER"
	}
}

func truncateCmd(cmd string, max int) string {
	cmd = strings.Join(strings.Fields(cmd), " ")
	if len(cmd) <= max {
		return cmd
	}
	return cmd[:max-1] + "…"
}

func perSec(cur, prev uint64, elapsed float64) float64 {
	if cur < prev || elapsed <= 0 {
		return 0
	}
	return float64(cur-prev) / elapsed
}
