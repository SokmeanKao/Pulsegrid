package metrics

import (
	"context"
	"runtime"
	"sort"
	"time"

	"github.com/pulsegrid/agent/internal/pb"
	"github.com/shirou/gopsutil/v3/process"
)

// lightProc is the cheap ranking row before enrichment.
type lightProc struct {
	pid   int32
	name  string
	cpuP  float64
	memMB float64
	rss   uint64
	vms   uint64
	state string
}

const (
	topCPUCount = 15
	topMemCount = 10
)

func (c *Collector) lightProcessesCached(
	ctx context.Context,
	prev *ioSnapshot,
) ([]lightProc, *pb.ProcessSummary, map[int32]float64, bool, error) {
	now := time.Now()
	c.procScan.mu.Lock()
	if len(c.procScan.lights) > 0 && now.Sub(c.procScan.at) < procScanTTL {
		lights := c.procScan.lights
		summary := cloneSummary(c.procScan.summary)
		cpuTotals := c.procScan.cpuTotals
		c.procScan.mu.Unlock()
		return lights, summary, cpuTotals, false, nil
	}
	c.procScan.mu.Unlock()

	cpuElapsed := 0.0
	if prev != nil && !prev.cpuAt.IsZero() {
		cpuElapsed = now.Sub(prev.cpuAt).Seconds()
	}
	lights, summary, cpuTotals, err := scanLightProcesses(ctx, prev, cpuElapsed)
	if err != nil {
		return nil, summary, nil, false, err
	}

	c.procScan.mu.Lock()
	c.procScan.at = now
	c.procScan.lights = lights
	c.procScan.summary = cloneSummary(summary)
	c.procScan.cpuTotals = cpuTotals
	c.procScan.mu.Unlock()
	return lights, summary, cpuTotals, true, nil
}

func cloneSummary(s *pb.ProcessSummary) *pb.ProcessSummary {
	if s == nil {
		return &pb.ProcessSummary{}
	}
	cp := *s
	return &cp
}

func (c *Collector) collectProcesses(
	ctx context.Context,
	prev *ioSnapshot,
	elapsed float64,
) ([]*pb.ProcessMetrics, *pb.ProcessSummary, error) {
	c.procScan.mu.Lock()
	if len(c.procScan.enriched) > 0 && time.Since(c.procScan.at) < procScanTTL {
		out := c.procScan.enriched
		sum := cloneSummary(c.procScan.enrSum)
		c.procScan.mu.Unlock()
		// Keep IO/CPU continuity on the live snapshot even when serving cached rows.
		c.mu.Lock()
		if c.previous != nil && prev != nil {
			c.previous.procIO = prev.procIO
			c.previous.procCPU = prev.procCPU
			c.previous.cpuAt = prev.cpuAt
		}
		c.mu.Unlock()
		return out, sum, nil
	}
	c.procScan.mu.Unlock()

	lights, summary, cpuTotals, fresh, err := c.lightProcessesCached(ctx, prev)
	if err != nil {
		return nil, &pb.ProcessSummary{}, err
	}

	byCPU := append([]lightProc(nil), lights...)
	sort.Slice(byCPU, func(i, j int) bool { return byCPU[i].cpuP > byCPU[j].cpuP })
	byMem := append([]lightProc(nil), lights...)
	sort.Slice(byMem, func(i, j int) bool { return byMem[i].memMB > byMem[j].memMB })

	seen := map[int32]struct{}{}
	selected := make([]lightProc, 0, topCPUCount+topMemCount)
	pick := func(list []lightProc, n int) {
		for i := 0; i < len(list) && n > 0; i++ {
			if _, ok := seen[list[i].pid]; ok {
				continue
			}
			seen[list[i].pid] = struct{}{}
			selected = append(selected, list[i])
			n--
		}
	}
	pick(byCPU, topCPUCount)
	pick(byMem, topMemCount)

	procIO := make(map[int32]procIOSnap, len(selected))
	out := make([]*pb.ProcessMetrics, 0, len(selected))
	for _, L := range selected {
		p, err := process.NewProcessWithContext(ctx, L.pid)
		if err != nil {
			out = append(out, &pb.ProcessMetrics{
				Pid:        L.pid,
				Name:       L.name,
				State:      L.state,
				CpuPercent: L.cpuP,
				MemoryMb:   L.memMB,
				RssBytes:   L.rss,
				VmsBytes:   L.vms,
				Command:    L.name,
			})
			continue
		}

		ppid, _ := p.PpidWithContext(ctx)
		var username string
		if runtime.GOOS != "windows" {
			username, _ = p.UsernameWithContext(ctx)
		}
		threads, _ := p.NumThreadsWithContext(ctx)
		if threads > 0 {
			summary.Threads += uint32(threads)
		}

		var readB, writeB uint64
		if ioC, err := p.IOCountersWithContext(ctx); err == nil && ioC != nil {
			readB, writeB = ioC.ReadBytes, ioC.WriteBytes
		}
		procIO[L.pid] = procIOSnap{read: readB, write: writeB}

		var readRate, writeRate float64
		if prev != nil && elapsed > 0 {
			if old, ok := prev.procIO[L.pid]; ok {
				readRate = perSec(readB, old.read, elapsed)
				writeRate = perSec(writeB, old.write, elapsed)
			}
		}

		createTs, _ := p.CreateTimeWithContext(ctx)
		cmdline := L.name
		if runtime.GOOS != "windows" {
			if c, err := p.CmdlineWithContext(ctx); err == nil && c != "" {
				cmdline = c
			}
		}
		state := L.state
		if state == "" || state == "UNKNOWN" {
			if statuses, err := p.StatusWithContext(ctx); err == nil && len(statuses) > 0 {
				state = normalizeState(statuses[0])
			}
		}

		out = append(out, &pb.ProcessMetrics{
			Pid:              L.pid,
			Ppid:             int32(ppid),
			Name:             L.name,
			User:             username,
			State:            state,
			CpuPercent:       L.cpuP,
			MemoryMb:         L.memMB,
			ThreadCount:      uint32(threads),
			RssBytes:         L.rss,
			VmsBytes:         L.vms,
			ReadBytesPerSec:  readRate,
			WriteBytesPerSec: writeRate,
			StartTimeUnixMs:  createTs,
			Command:          truncateCmd(cmdline, 120),
		})
	}

	c.mu.Lock()
	if c.previous != nil {
		c.previous.procIO = procIO
		if fresh {
			c.previous.procCPU = cpuTotals
			c.previous.cpuAt = time.Now()
		} else if prev != nil {
			c.previous.procCPU = prev.procCPU
			c.previous.cpuAt = prev.cpuAt
		}
	}
	c.mu.Unlock()

	c.procScan.mu.Lock()
	c.procScan.enriched = out
	c.procScan.enrSum = cloneSummary(summary)
	c.procScan.mu.Unlock()

	return out, summary, nil
}

func cpuPercentFromDelta(prev *ioSnapshot, pid int32, total float64, elapsed float64) float64 {
	if prev == nil || elapsed <= 0 {
		return 0
	}
	old, ok := prev.procCPU[pid]
	if !ok || total < old {
		return 0
	}
	return 100 * (total - old) / elapsed
}

func bumpState(summary *pb.ProcessSummary, state string) {
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
}
