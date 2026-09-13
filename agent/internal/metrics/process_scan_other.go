//go:build !windows

package metrics

import (
	"context"

	"github.com/pulsegrid/agent/internal/pb"
	"github.com/shirou/gopsutil/v3/process"
)

// scanLightProcesses ranks with /proc-style Times + Memory (no cmdline/user/IO).
func scanLightProcesses(ctx context.Context, prev *ioSnapshot, elapsed float64) ([]lightProc, *pb.ProcessSummary, map[int32]float64, error) {
	procs, err := process.ProcessesWithContext(ctx)
	if err != nil {
		return nil, &pb.ProcessSummary{}, nil, err
	}

	summary := &pb.ProcessSummary{}
	lights := make([]lightProc, 0, len(procs))
	cpuTotals := make(map[int32]float64, len(procs))

	for _, p := range procs {
		name, err := p.NameWithContext(ctx)
		if err != nil || name == "" {
			continue
		}
		summary.Total++

		state := "UNKNOWN"
		if statuses, err := p.StatusWithContext(ctx); err == nil && len(statuses) > 0 {
			state = normalizeState(statuses[0])
		}
		bumpState(summary, state)

		var cpuTotal float64
		if t, err := p.TimesWithContext(ctx); err == nil && t != nil {
			cpuTotal = t.User + t.System + t.Nice + t.Iowait + t.Irq + t.Softirq + t.Steal
			cpuTotals[p.Pid] = cpuTotal
		}

		var rss, vms uint64
		memMB := 0.0
		if mi, err := p.MemoryInfoWithContext(ctx); err == nil && mi != nil {
			rss, vms = mi.RSS, mi.VMS
			memMB = float64(mi.RSS) / (1024 * 1024)
		}

		lights = append(lights, lightProc{
			pid:   p.Pid,
			name:  name,
			cpuP:  cpuPercentFromDelta(prev, p.Pid, cpuTotal, elapsed),
			memMB: memMB,
			rss:   rss,
			vms:   vms,
			state: state,
		})
	}

	return lights, summary, cpuTotals, nil
}
