package com.monitoring.backend.metrics;

import com.monitoring.backend.grpc.gen.CpuMetrics;
import com.monitoring.backend.grpc.gen.DiskMetrics;
import com.monitoring.backend.grpc.gen.MemoryMetrics;
import com.monitoring.backend.grpc.gen.MetricsEnvelope;
import com.monitoring.backend.grpc.gen.NetworkMetrics;
import com.monitoring.backend.grpc.gen.ProcessMetrics;

import java.util.ArrayList;
import java.util.List;

public final class EnvelopeMapper {

	private EnvelopeMapper() {}

	public static MetricsEnvelopeDto toDto(MetricsEnvelope value) {
		List<MetricsEnvelopeDto.DiskMetricsDto> disks = new ArrayList<>();
		for (DiskMetrics d : value.getDisksList()) {
			disks.add(new MetricsEnvelopeDto.DiskMetricsDto(
					d.getMount(), d.getDevice(), d.getUsedGb(), d.getTotalGb(),
					d.getReadBytesPerSec(), d.getWriteBytesPerSec(),
					d.getReadOpsPerSec(), d.getWriteOpsPerSec()));
		}
		List<MetricsEnvelopeDto.NetworkMetricsDto> networks = new ArrayList<>();
		for (NetworkMetrics n : value.getNetworksList()) {
			networks.add(new MetricsEnvelopeDto.NetworkMetricsDto(
					n.getInterfaceName(),
					n.getRxBytesPerSec(), n.getTxBytesPerSec(),
					n.getRxPacketsPerSec(), n.getTxPacketsPerSec(),
					n.getRxErrors(), n.getTxErrors(), n.getRxDropped(), n.getTxDropped(),
					n.getRxBytesTotal(), n.getTxBytesTotal()));
		}
		List<MetricsEnvelopeDto.ProcessMetricsDto> processes = new ArrayList<>();
		for (ProcessMetrics p : value.getTopProcessesList()) {
			processes.add(new MetricsEnvelopeDto.ProcessMetricsDto(
					p.getPid(), p.getName(), p.getCpuPercent(), p.getMemoryMb()));
		}

		CpuMetrics cpu = value.getCpu();
		MemoryMetrics mem = value.getMemory();
		return new MetricsEnvelopeDto(
				value.getServerId(),
				value.getCollectedAtUnixMs(),
				value.getSequence(),
				new MetricsEnvelopeDto.HostInfoDto(
						value.getHost().getHostname(),
						value.getHost().getOs(),
						value.getHost().getArch(),
						value.getHost().getPlatform()),
				new MetricsEnvelopeDto.CpuMetricsDto(
						cpu.getUsagePercent(), (int) cpu.getLogicalCores(),
						cpu.getLoad1(), cpu.getLoad5(), cpu.getLoad15(),
						cpu.getPerCorePercentList()),
				new MetricsEnvelopeDto.MemoryMetricsDto(
						mem.getTotalMb(), mem.getUsedMb(), mem.getAvailableMb(), mem.getCachedMb(),
						mem.getSwapTotalMb(), mem.getSwapUsedMb()),
				disks,
				networks,
				processes,
				new MetricsEnvelopeDto.AgentInfoDto(
						value.getAgent().getVersion(),
						value.getAgent().getGoVersion(),
						value.getAgent().getStartedAtUnixMs(),
						value.getAgent().getSamplesSent()));
	}
}
