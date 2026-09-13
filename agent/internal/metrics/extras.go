package metrics

import (
	"context"
	"os/exec"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/pulsegrid/agent/internal/pb"
	"github.com/shirou/gopsutil/v3/host"
	"github.com/shirou/gopsutil/v3/load"
)

const extrasCacheTTL = 15 * time.Second

type extrasCache struct {
	mu        sync.Mutex
	docker    *pb.DockerSummary
	dockerAt  time.Time
	sensors   *pb.SensorSummary
	sensorsAt time.Time
	dockerBusy  bool
	sensorsBusy bool
}

func (c *extrasCache) dockerCached(now time.Time) (*pb.DockerSummary, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.docker != nil && now.Sub(c.dockerAt) < extrasCacheTTL {
		return c.docker, true
	}
	return c.docker, false
}

func (c *extrasCache) storeDocker(now time.Time, d *pb.DockerSummary) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.docker = d
	c.dockerAt = now
	c.dockerBusy = false
}

func (c *extrasCache) sensorsCached(now time.Time) (*pb.SensorSummary, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.sensors != nil && now.Sub(c.sensorsAt) < extrasCacheTTL {
		return c.sensors, true
	}
	return c.sensors, false
}

func (c *extrasCache) storeSensors(now time.Time, s *pb.SensorSummary) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.sensors = s
	c.sensorsAt = now
	c.sensorsBusy = false
}

func (c *extrasCache) tryStartDocker() bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.dockerBusy {
		return false
	}
	c.dockerBusy = true
	return true
}

func (c *extrasCache) tryStartSensors() bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.sensorsBusy {
		return false
	}
	c.sensorsBusy = true
	return true
}

func collectHostExtras(ctx context.Context) *pb.HostExtras {
	out := &pb.HostExtras{}
	if up, err := host.UptimeWithContext(ctx); err == nil {
		out.UptimeSeconds = up
	}
	if avg, err := load.AvgWithContext(ctx); err == nil && avg != nil {
		out.Load1 = avg.Load1
		out.Load5 = avg.Load5
		out.Load15 = avg.Load15
		out.LoadAvailable = true
	}
	return out
}

func (c *Collector) dockerSummary(ctx context.Context, now time.Time) *pb.DockerSummary {
	cached, fresh := c.extras.dockerCached(now)
	if fresh {
		return cached
	}
	if c.extras.tryStartDocker() {
		go func() {
			defer func() {
				if recover() != nil {
					c.extras.mu.Lock()
					c.extras.dockerBusy = false
					c.extras.mu.Unlock()
				}
			}()
			sum := collectDocker(context.Background())
			c.extras.storeDocker(time.Now(), sum)
		}()
	}
	if cached != nil {
		return cached
	}
	return &pb.DockerSummary{Available: false, ErrorMessage: "probing"}
}

func (c *Collector) sensorsSummary(ctx context.Context, now time.Time) *pb.SensorSummary {
	cached, fresh := c.extras.sensorsCached(now)
	if fresh {
		return cached
	}
	if c.extras.tryStartSensors() {
		go func() {
			defer func() {
				if recover() != nil {
					c.extras.mu.Lock()
					c.extras.sensorsBusy = false
					c.extras.mu.Unlock()
				}
			}()
			sum := collectSensors(context.Background())
			c.extras.storeSensors(time.Now(), sum)
		}()
	}
	if cached != nil {
		return cached
	}
	return &pb.SensorSummary{}
}

func collectDocker(ctx context.Context) *pb.DockerSummary {
	// Keep short — docker stats alone can take ~1s; we only run this on cache miss.
	ctx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()

	infoOut, err := exec.CommandContext(ctx, "docker", "info", "--format", "{{.ServerVersion}}|{{.ContainersRunning}}|{{.ContainersPaused}}|{{.ContainersStopped}}|{{.Images}}").Output()
	if err != nil {
		msg := "docker unavailable"
		if ee, ok := err.(*exec.ExitError); ok && len(ee.Stderr) > 0 {
			msg = strings.TrimSpace(string(ee.Stderr))
			if len(msg) > 120 {
				msg = msg[:117] + "…"
			}
		}
		return &pb.DockerSummary{Available: false, ErrorMessage: msg}
	}
	parts := strings.Split(strings.TrimSpace(string(infoOut)), "|")
	sum := &pb.DockerSummary{Available: true}
	if len(parts) >= 5 {
		sum.ServerVersion = parts[0]
		sum.ContainersRunning = parseU32(parts[1])
		sum.ContainersPaused = parseU32(parts[2])
		sum.ContainersStopped = parseU32(parts[3])
		sum.Images = parseU32(parts[4])
	}

	statsOut, err := exec.CommandContext(ctx, "docker", "stats", "--no-stream", "--format", "{{.ID}}\t{{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}").Output()
	if err != nil {
		return sum
	}
	lines := strings.Split(strings.TrimSpace(string(statsOut)), "\n")
	type row struct {
		c   *pb.DockerContainer
		cpu float64
	}
	var rows []row
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		f := strings.Split(line, "\t")
		if len(f) < 4 {
			continue
		}
		cpu := parsePercent(f[2])
		mem := parseMemMB(f[3])
		id := f[0]
		if len(id) > 12 {
			id = id[:12]
		}
		rows = append(rows, row{
			cpu: cpu,
			c: &pb.DockerContainer{
				Id:         id,
				Name:       f[1],
				State:      "running",
				CpuPercent: cpu,
				MemoryMb:   mem,
			},
		})
	}
	for i := 0; i < len(rows); i++ {
		for j := i + 1; j < len(rows); j++ {
			if rows[j].cpu > rows[i].cpu {
				rows[i], rows[j] = rows[j], rows[i]
			}
		}
	}
	limit := 8
	if len(rows) < limit {
		limit = len(rows)
	}
	for i := 0; i < limit; i++ {
		sum.TopContainers = append(sum.TopContainers, rows[i].c)
	}
	return sum
}

func collectSensors(ctx context.Context) *pb.SensorSummary {
	ctx, cancel := context.WithTimeout(ctx, 800*time.Millisecond)
	defer cancel()
	out := &pb.SensorSummary{}

	cmd := exec.CommandContext(ctx, "nvidia-smi",
		"--query-gpu=name,utilization.gpu,memory.used,memory.total,temperature.gpu",
		"--format=csv,noheader,nounits")
	b, err := cmd.Output()
	if err == nil {
		for _, line := range strings.Split(strings.TrimSpace(string(b)), "\n") {
			line = strings.TrimSpace(line)
			if line == "" {
				continue
			}
			f := strings.Split(line, ",")
			if len(f) < 5 {
				continue
			}
			for i := range f {
				f[i] = strings.TrimSpace(f[i])
			}
			gpu := &pb.GpuSensor{
				Name:               f[0],
				UtilizationPercent: parseFloat(f[1]),
				MemoryUsedMb:       parseFloat(f[2]),
				MemoryTotalMb:      parseFloat(f[3]),
				TemperatureC:       parseFloat(f[4]),
			}
			out.Gpus = append(out.Gpus, gpu)
			if gpu.TemperatureC > 0 {
				out.Temperatures = append(out.Temperatures, &pb.TempSensor{
					Name:    gpu.Name + " GPU",
					Celsius: gpu.TemperatureC,
				})
			}
		}
	}
	return out
}

func parseU32(s string) uint32 {
	n, _ := strconv.ParseUint(strings.TrimSpace(s), 10, 32)
	return uint32(n)
}

func parseFloat(s string) float64 {
	n, _ := strconv.ParseFloat(strings.TrimSpace(s), 64)
	return n
}

func parsePercent(s string) float64 {
	s = strings.TrimSpace(strings.TrimSuffix(s, "%"))
	return parseFloat(s)
}

func parseMemMB(s string) float64 {
	s = strings.TrimSpace(strings.Split(s, "/")[0])
	s = strings.TrimSpace(s)
	upper := strings.ToUpper(s)
	mult := 1.0
	switch {
	case strings.HasSuffix(upper, "GIB"):
		mult = 1024
		s = s[:len(s)-3]
	case strings.HasSuffix(upper, "GB"):
		mult = 1024
		s = s[:len(s)-2]
	case strings.HasSuffix(upper, "MIB"):
		mult = 1
		s = s[:len(s)-3]
	case strings.HasSuffix(upper, "MB"):
		mult = 1
		s = s[:len(s)-2]
	case strings.HasSuffix(upper, "KIB"):
		mult = 1.0 / 1024
		s = s[:len(s)-3]
	case strings.HasSuffix(upper, "KB"):
		mult = 1.0 / 1024
		s = s[:len(s)-2]
	}
	return parseFloat(strings.TrimSpace(s)) * mult
}
