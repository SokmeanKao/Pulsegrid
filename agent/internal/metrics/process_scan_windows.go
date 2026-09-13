//go:build windows

package metrics

import (
	"context"
	"fmt"
	"syscall"
	"unsafe"

	"github.com/pulsegrid/agent/internal/pb"
	"golang.org/x/sys/windows"
)

// scanLightProcesses uses one Toolhelp snapshot for names and a single
// OpenProcess per PID for CPU times + working set (avoids 3+ opens/PID).
func scanLightProcesses(ctx context.Context, prev *ioSnapshot, elapsed float64) ([]lightProc, *pb.ProcessSummary, map[int32]float64, error) {
	_ = ctx
	summary := &pb.ProcessSummary{}

	snap, err := windows.CreateToolhelp32Snapshot(windows.TH32CS_SNAPPROCESS, 0)
	if err != nil {
		return nil, summary, nil, fmt.Errorf("process snapshot: %w", err)
	}
	defer windows.CloseHandle(snap)

	var entry windows.ProcessEntry32
	entry.Size = uint32(unsafe.Sizeof(entry))
	if err := windows.Process32First(snap, &entry); err != nil {
		return nil, summary, nil, fmt.Errorf("process first: %w", err)
	}

	lights := make([]lightProc, 0, 256)
	cpuTotals := make(map[int32]float64, 256)

	for {
		pid := int32(entry.ProcessID)
		name := windows.UTF16ToString(entry.ExeFile[:])
		if pid != 0 && name != "" {
			summary.Total++
			summary.Other++ // Status is not available cheaply on Windows.

			cpuTotal, rss, vms, ok := winProcTimesAndMem(pid)
			if ok {
				cpuTotals[pid] = cpuTotal
				lights = append(lights, lightProc{
					pid:   pid,
					name:  name,
					cpuP:  cpuPercentFromDelta(prev, pid, cpuTotal, elapsed),
					memMB: float64(rss) / (1024 * 1024),
					rss:   rss,
					vms:   vms,
					state: "OTHER",
				})
			} else {
				lights = append(lights, lightProc{
					pid:   pid,
					name:  name,
					state: "OTHER",
				})
			}
		}

		if err := windows.Process32Next(snap, &entry); err != nil {
			break
		}
	}

	return lights, summary, cpuTotals, nil
}

func winProcTimesAndMem(pid int32) (cpuTotal float64, rss, vms uint64, ok bool) {
	h, err := windows.OpenProcess(windows.PROCESS_QUERY_INFORMATION, false, uint32(pid))
	if err != nil {
		// Fallback for protected/system processes on newer Windows.
		h, err = windows.OpenProcess(windows.PROCESS_QUERY_LIMITED_INFORMATION, false, uint32(pid))
		if err != nil {
			return 0, 0, 0, false
		}
	}
	defer windows.CloseHandle(h)

	var create, exit, kernel, user windows.Filetime
	if err := windows.GetProcessTimes(h, &create, &exit, &kernel, &user); err != nil {
		return 0, 0, 0, false
	}
	cpuTotal = filetimeSeconds(user) + filetimeSeconds(kernel)

	var mem processMemoryCounters
	mem.CB = uint32(unsafe.Sizeof(mem))
	if err := getProcessMemoryInfo(h, &mem); err == nil {
		rss = uint64(mem.WorkingSetSize)
		vms = uint64(mem.PagefileUsage)
	}
	return cpuTotal, rss, vms, true
}

func filetimeSeconds(ft windows.Filetime) float64 {
	// 100-ns intervals → seconds (same conversion gopsutil uses).
	return float64(ft.HighDateTime)*429.4967296 + float64(ft.LowDateTime)*1e-7
}

type processMemoryCounters struct {
	CB                         uint32
	PageFaultCount             uint32
	PeakWorkingSetSize         uintptr
	WorkingSetSize             uintptr
	QuotaPeakPagedPoolUsage    uintptr
	QuotaPagedPoolUsage        uintptr
	QuotaPeakNonPagedPoolUsage uintptr
	QuotaNonPagedPoolUsage     uintptr
	PagefileUsage              uintptr
	PeakPagefileUsage          uintptr
}

var (
	modpsapi              = windows.NewLazySystemDLL("psapi.dll")
	procGetProcessMemoryInfo = modpsapi.NewProc("GetProcessMemoryInfo")
)

func getProcessMemoryInfo(h windows.Handle, mem *processMemoryCounters) error {
	r1, _, e1 := procGetProcessMemoryInfo.Call(uintptr(h), uintptr(unsafe.Pointer(mem)), uintptr(mem.CB))
	if r1 == 0 {
		if errno, ok := e1.(windows.Errno); ok && errno != 0 {
			return errno
		}
		return syscall.EINVAL
	}
	return nil
}
