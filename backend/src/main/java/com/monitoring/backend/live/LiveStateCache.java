package com.monitoring.backend.live;

import com.monitoring.backend.metrics.MetricsEnvelopeDto;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class LiveStateCache {

	public enum ConnectionState { CONNECTED, DISCONNECTED }
	public enum HealthState { HEALTHY, WARNING, CRITICAL, OFFLINE, UNKNOWN }

	public record ServerLiveState(
			String serverId,
			ConnectionState connection,
			HealthState health,
			Instant lastSeen,
			MetricsEnvelopeDto latest
	) {}

	private final Map<String, ServerLiveState> states = new ConcurrentHashMap<>();

	public void markDisconnected(String serverId) {
		states.compute(serverId, (id, prev) -> {
			HealthState health = prev == null || prev.latest() == null
					? HealthState.UNKNOWN
					: deriveHealth(prev.latest(), false, prev.lastSeen());
			Instant lastSeen = prev == null ? null : prev.lastSeen();
			MetricsEnvelopeDto latest = prev == null ? null : prev.latest();
			HealthState offlineAware = isStale(lastSeen) ? HealthState.OFFLINE : health;
			return new ServerLiveState(id, ConnectionState.DISCONNECTED, offlineAware, lastSeen, latest);
		});
	}

	public void upsertSample(MetricsEnvelopeDto sample, boolean connected) {
		Instant now = Instant.now();
		HealthState health = deriveHealth(sample, connected, now);
		states.put(sample.serverId(), new ServerLiveState(
				sample.serverId(),
				connected ? ConnectionState.CONNECTED : ConnectionState.DISCONNECTED,
				health,
				now,
				sample));
	}

	public List<ServerLiveState> all() {
		List<ServerLiveState> list = new ArrayList<>();
		states.forEach((id, state) -> list.add(refreshStale(state)));
		list.sort((a, b) -> a.serverId().compareTo(b.serverId()));
		return list;
	}

	public ServerLiveState get(String serverId) {
		ServerLiveState state = states.get(serverId);
		return state == null ? null : refreshStale(state);
	}

	private ServerLiveState refreshStale(ServerLiveState state) {
		if (state.lastSeen() != null && isStale(state.lastSeen())
				&& state.health() != HealthState.OFFLINE) {
			return new ServerLiveState(
					state.serverId(),
					ConnectionState.DISCONNECTED,
					HealthState.OFFLINE,
					state.lastSeen(),
					state.latest());
		}
		return state;
	}

	private static boolean isStale(Instant lastSeen) {
		return lastSeen == null || lastSeen.isBefore(Instant.now().minusSeconds(30));
	}

	static HealthState deriveHealth(MetricsEnvelopeDto sample, boolean connected, Instant lastSeen) {
		if (!connected || isStale(lastSeen)) {
			return sample == null ? HealthState.UNKNOWN : HealthState.OFFLINE;
		}
		if (sample == null || sample.cpu() == null || sample.memory() == null) {
			return HealthState.UNKNOWN;
		}
		double cpu = sample.cpu().usagePercent();
		double memPct = sample.memory().totalMb() <= 0 ? 0
				: (sample.memory().usedMb() / sample.memory().totalMb()) * 100.0;
		double maxDisk = 0;
		if (sample.disks() != null) {
			for (var d : sample.disks()) {
				if (d.totalGb() > 0) {
					maxDisk = Math.max(maxDisk, (d.usedGb() / d.totalGb()) * 100.0);
				}
			}
		}
		if (cpu >= 95 || memPct >= 95 || maxDisk >= 95) {
			return HealthState.CRITICAL;
		}
		if (cpu >= 80 || memPct >= 85 || maxDisk >= 80) {
			return HealthState.WARNING;
		}
		return HealthState.HEALTHY;
	}
}
