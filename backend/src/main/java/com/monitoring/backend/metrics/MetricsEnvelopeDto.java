package com.monitoring.backend.metrics;

import java.util.List;

public record MetricsEnvelopeDto(
		String serverId,
		long collectedAtUnixMs,
		long sequence,
		HostInfoDto host,
		CpuMetricsDto cpu,
		MemoryMetricsDto memory,
		List<DiskMetricsDto> disks,
		List<NetworkMetricsDto> networks,
		List<ProcessMetricsDto> topProcesses,
		AgentInfoDto agent,
		ProcessSummaryDto processSummary,
		HostExtrasDto hostExtras,
		DockerSummaryDto docker,
		SensorSummaryDto sensors
) {
	public record HostInfoDto(String hostname, String os, String arch, String platform) {}
	public record AgentInfoDto(String version, String goVersion, long startedAtUnixMs, long samplesSent) {}
	public record CpuMetricsDto(
			double usagePercent,
			int logicalCores,
			double load1,
			double load5,
			double load15,
			List<Double> perCorePercent) {}
	public record MemoryMetricsDto(
			double totalMb, double usedMb, double availableMb, double cachedMb,
			double swapTotalMb, double swapUsedMb) {}
	public record DiskMetricsDto(
			String mount, String device, double usedGb, double totalGb,
			double readBytesPerSec, double writeBytesPerSec,
			double readOpsPerSec, double writeOpsPerSec) {}
	public record NetworkMetricsDto(
			String interfaceName,
			double rxBytesPerSec, double txBytesPerSec,
			double rxPacketsPerSec, double txPacketsPerSec,
			long rxErrors, long txErrors, long rxDropped, long txDropped,
			long rxBytesTotal, long txBytesTotal) {}
	public record ProcessMetricsDto(
			int pid,
			int ppid,
			String name,
			String user,
			String state,
			double cpuPercent,
			double memoryMb,
			int threadCount,
			long rssBytes,
			long vmsBytes,
			double readBytesPerSec,
			double writeBytesPerSec,
			long startTimeUnixMs,
			String command) {}
	public record ProcessSummaryDto(
			int total,
			int running,
			int sleeping,
			int zombie,
			int stopped,
			int idle,
			int other,
			int threads) {}
	public record HostExtrasDto(
			long uptimeSeconds,
			double load1,
			double load5,
			double load15,
			boolean loadAvailable) {}
	public record DockerContainerDto(
			String id,
			String name,
			String image,
			String state,
			double cpuPercent,
			double memoryMb) {}
	public record DockerSummaryDto(
			boolean available,
			String serverVersion,
			int containersRunning,
			int containersPaused,
			int containersStopped,
			int images,
			List<DockerContainerDto> topContainers,
			String errorMessage) {}
	public record GpuSensorDto(
			String name,
			double utilizationPercent,
			double memoryUsedMb,
			double memoryTotalMb,
			double temperatureC) {}
	public record TempSensorDto(String name, double celsius) {}
	public record SensorSummaryDto(
			List<GpuSensorDto> gpus,
			List<TempSensorDto> temperatures) {}
}
