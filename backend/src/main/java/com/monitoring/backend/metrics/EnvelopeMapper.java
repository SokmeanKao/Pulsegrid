package com.monitoring.backend.metrics;

import com.monitoring.backend.grpc.gen.CpuMetrics;
import com.monitoring.backend.grpc.gen.DiskMetrics;
import com.monitoring.backend.grpc.gen.DockerContainer;
import com.monitoring.backend.grpc.gen.DockerSummary;
import com.monitoring.backend.grpc.gen.GpuSensor;
import com.monitoring.backend.grpc.gen.HostExtras;
import com.monitoring.backend.grpc.gen.MemoryMetrics;
import com.monitoring.backend.grpc.gen.MetricsEnvelope;
import com.monitoring.backend.grpc.gen.NetworkMetrics;
import com.monitoring.backend.grpc.gen.ProcessMetrics;
import com.monitoring.backend.grpc.gen.ProcessSummary;
import com.monitoring.backend.grpc.gen.SensorSummary;
import com.monitoring.backend.grpc.gen.TempSensor;

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
					p.getPid(),
					p.getPpid(),
					p.getName(),
					p.getUser(),
					p.getState(),
					p.getCpuPercent(),
					p.getMemoryMb(),
					(int) p.getThreadCount(),
					p.getRssBytes(),
					p.getVmsBytes(),
					p.getReadBytesPerSec(),
					p.getWriteBytesPerSec(),
					p.getStartTimeUnixMs(),
					p.getCommand()));
		}

		ProcessSummary ps = value.getProcessSummary();
		MetricsEnvelopeDto.ProcessSummaryDto summary = new MetricsEnvelopeDto.ProcessSummaryDto(
				(int) ps.getTotal(),
				(int) ps.getRunning(),
				(int) ps.getSleeping(),
				(int) ps.getZombie(),
				(int) ps.getStopped(),
				(int) ps.getIdle(),
				(int) ps.getOther(),
				(int) ps.getThreads());

		HostExtras he = value.getHostExtras();
		MetricsEnvelopeDto.HostExtrasDto hostExtras = new MetricsEnvelopeDto.HostExtrasDto(
				he.getUptimeSeconds(),
				he.getLoad1(),
				he.getLoad5(),
				he.getLoad15(),
				he.getLoadAvailable());

		DockerSummary ds = value.getDocker();
		List<MetricsEnvelopeDto.DockerContainerDto> containers = new ArrayList<>();
		for (DockerContainer c : ds.getTopContainersList()) {
			containers.add(new MetricsEnvelopeDto.DockerContainerDto(
					c.getId(), c.getName(), c.getImage(), c.getState(),
					c.getCpuPercent(), c.getMemoryMb()));
		}
		MetricsEnvelopeDto.DockerSummaryDto docker = new MetricsEnvelopeDto.DockerSummaryDto(
				ds.getAvailable(),
				ds.getServerVersion(),
				(int) ds.getContainersRunning(),
				(int) ds.getContainersPaused(),
				(int) ds.getContainersStopped(),
				(int) ds.getImages(),
				containers,
				ds.getErrorMessage());

		SensorSummary ss = value.getSensors();
		List<MetricsEnvelopeDto.GpuSensorDto> gpus = new ArrayList<>();
		for (GpuSensor g : ss.getGpusList()) {
			gpus.add(new MetricsEnvelopeDto.GpuSensorDto(
					g.getName(), g.getUtilizationPercent(),
					g.getMemoryUsedMb(), g.getMemoryTotalMb(), g.getTemperatureC()));
		}
		List<MetricsEnvelopeDto.TempSensorDto> temps = new ArrayList<>();
		for (TempSensor t : ss.getTemperaturesList()) {
			temps.add(new MetricsEnvelopeDto.TempSensorDto(t.getName(), t.getCelsius()));
		}
		MetricsEnvelopeDto.SensorSummaryDto sensors = new MetricsEnvelopeDto.SensorSummaryDto(gpus, temps);

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
						value.getAgent().getSamplesSent()),
				summary,
				hostExtras,
				docker,
				sensors);
	}
}
