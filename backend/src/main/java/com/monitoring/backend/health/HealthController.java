package com.monitoring.backend.health;

import com.monitoring.backend.grpc.AgentClient;
import com.monitoring.backend.live.LiveStateCache;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
public class HealthController {

	private final AgentClient agentClient;
	private final LiveStateCache liveStateCache;

	public HealthController(AgentClient agentClient, LiveStateCache liveStateCache) {
		this.agentClient = agentClient;
		this.liveStateCache = liveStateCache;
	}

	@GetMapping("/healthz")
	public ResponseEntity<Map<String, Object>> healthz() {
		Map<String, Object> body = new LinkedHashMap<>();
		body.put("status", "UP");
		body.put("agents", agentClient.connectionStatus());
		body.put("servers", liveStateCache.all().stream().map(s -> {
			Map<String, Object> row = new LinkedHashMap<>();
			row.put("serverId", s.serverId());
			row.put("connection", s.connection().name());
			row.put("health", s.health().name());
			row.put("lastSeen", s.lastSeen() == null ? null : s.lastSeen().toString());
			return row;
		}).toList());
		return ResponseEntity.ok(body);
	}
}
