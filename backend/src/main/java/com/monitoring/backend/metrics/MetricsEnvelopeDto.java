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
		AgentInfoDto agent
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
	public record ProcessMetricsDto(int pid, String name, double cpuPercent, double memoryMb) {}
}
