package com.monitoring.backend.gateway;

import com.monitoring.backend.grpc.gen.MonitorMessage;
import io.grpc.stub.StreamObserver;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class AgentSessionRegistry {

	public record Session(String serverId, StreamObserver<MonitorMessage> outbound) {}

	private final ConcurrentHashMap<String, Session> sessions = new ConcurrentHashMap<>();

	/** Returns previous session if this serverId was already connected. */
	public Session put(String serverId, StreamObserver<MonitorMessage> outbound) {
		Session next = new Session(serverId, outbound);
		return sessions.put(serverId, next);
	}

	public void remove(String serverId, StreamObserver<MonitorMessage> outbound) {
		sessions.computeIfPresent(serverId, (id, cur) -> cur.outbound() == outbound ? null : cur);
	}

	public boolean isConnected(String serverId) {
		return sessions.containsKey(serverId);
	}

	public Map<String, String> connectionStatus() {
		ConcurrentHashMap<String, String> status = new ConcurrentHashMap<>();
		sessions.forEach((id, session) -> status.put(id, "connected"));
		return status;
	}

	public int size() {
		return sessions.size();
	}
}
