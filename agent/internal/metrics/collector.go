package metrics

import (
	"context"
	"fmt"
	"os"
	"runtime"
	"sort"
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
	"github.com/shirou/gopsutil/v3/process"
)

// AgentVersion is the agent build version. Override at link time:
// go build -ldflags "-X github.com/pulsegrid/agent/internal/metrics.AgentVersion=1.3.0"
var AgentVersion = "2.0.0"

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
}

type procIOSnap struct {
	read  uint64
	write uint64
}

type Collector struct {
	mu       sync.Mutex
	previous *ioSnapshot
	serverID string
}

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

	top, summary, _ := c.collectProcesses(ctx, now, prev, elapsed)

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

func (c *Collector) collectProcesses(
	ctx context.Context,
	now time.Time,
	prev *ioSnapshot,
	elapsed float64,
) ([]*pb.ProcessMetrics, *pb.ProcessSummary, error) {
	procs, err := process.ProcessesWithContext(ctx)
	if err != nil {
		return nil, &pb.ProcessSummary{}, err
	}

	type row struct {
		metric *pb.ProcessMetrics
		ioRead uint64
		ioWrit uint64
	}

	summary := &pb.ProcessSummary{}
	rows := make([]row, 0, len(procs))
	procIO := make(map[int32]procIOSnap, len(procs))

	for _, p := range procs {
		name, err := p.NameWithContext(ctx)
		if err != nil || name == "" {
			continue
		}
		summary.Total++

		cpuP, _ := p.CPUPercentWithContext(ctx)
		mi, _ := p.MemoryInfoWithContext(ctx)
		var rss, vms uint64
		memMB := 0.0
		if mi != nil {
			rss, vms = mi.RSS, mi.VMS
			memMB = float64(mi.RSS) / (1024 * 1024)
		}

		ppid, _ := p.PpidWithContext(ctx)
		username, _ := p.UsernameWithContext(ctx)
		statuses, _ := p.StatusWithContext(ctx)
		state := "UNKNOWN"
		if len(statuses) > 0 {
			state = normalizeState(statuses[0])
		}
		switch state {
		case "RUNNING":
			summary.Running++
		case "SLEEPING":
			summary.Sleeping++
		case "ZOMBIE":
			summary.Zombie++
		case "STOPPED":
			summary.Stopped++
		case "IDLE":
			summary.Idle++
		default:
			summary.Other++
		}

		threads, _ := p.NumThreadsWithContext(ctx)
		if threads > 0 {
			summary.Threads += uint32(threads)
		}

		var readB, writeB uint64
		if ioC, err := p.IOCountersWithContext(ctx); err == nil && ioC != nil {
			readB, writeB = ioC.ReadBytes, ioC.WriteBytes
		}
		procIO[p.Pid] = procIOSnap{read: readB, write: writeB}

		var readRate, writeRate float64
		if prev != nil && elapsed > 0 {
			if old, ok := prev.procIO[p.Pid]; ok {
				readRate = perSec(readB, old.read, elapsed)
				writeRate = perSec(writeB, old.write, elapsed)
			}
		}

		createTs, _ := p.CreateTimeWithContext(ctx)
		cmdline, _ := p.CmdlineWithContext(ctx)
		if cmdline == "" {
			cmdline = name
		}

		rows = append(rows, row{
			metric: &pb.ProcessMetrics{
				Pid:               p.Pid,
				Ppid:              int32(ppid),
				Name:              name,
				User:              username,
				State:             state,
				CpuPercent:        cpuP,
				MemoryMb:          memMB,
				ThreadCount:       uint32(threads),
				RssBytes:          rss,
				VmsBytes:          vms,
				ReadBytesPerSec:   readRate,
				WriteBytesPerSec:  writeRate,
				StartTimeUnixMs:   createTs,
				Command:           truncateCmd(cmdline, 120),
			},
			ioRead: readB,
			ioWrit: writeB,
		})
	}

	c.mu.Lock()
	if c.previous != nil {
		c.previous.procIO = procIO
	}
	c.mu.Unlock()

	byCPU := append([]row(nil), rows...)
	sort.Slice(byCPU, func(i, j int) bool {
		return byCPU[i].metric.CpuPercent > byCPU[j].metric.CpuPercent
	})
	byMem := append([]row(nil), rows...)
	sort.Slice(byMem, func(i, j int) bool {
		return byMem[i].metric.MemoryMb > byMem[j].metric.MemoryMb
	})
	byIO := append([]row(nil), rows...)
	sort.Slice(byIO, func(i, j int) bool {
		ai := byIO[i].metric.ReadBytesPerSec + byIO[i].metric.WriteBytesPerSec
		aj := byIO[j].metric.ReadBytesPerSec + byIO[j].metric.WriteBytesPerSec
		return ai > aj
	})

	seen := map[int32]struct{}{}
	out := make([]*pb.ProcessMetrics, 0, 40)
	add := func(list []row, n int) {
		for i := 0; i < len(list) && n > 0; i++ {
			r := list[i]
			if _, ok := seen[r.metric.Pid]; ok {
				continue
			}
			seen[r.metric.Pid] = struct{}{}
			out = append(out, r.metric)
			n--
		}
	}
	add(byCPU, 15)
	add(byMem, 10)
	add(byIO, 5)
	return out, summary, nil
}

func perSec(cur, prev uint64, elapsed float64) float64 {
	if cur < prev || elapsed <= 0 {
		return 0
	}
	return float64(cur-prev) / elapsed
}
