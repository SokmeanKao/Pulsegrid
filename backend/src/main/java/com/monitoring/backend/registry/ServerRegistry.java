package com.monitoring.backend.registry;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Component
@Order(1)
public class ServerRegistry implements ApplicationRunner {

	private final JdbcTemplate jdbc;
	private final String agentsEnv;
	private volatile Map<String, AgentEndpoint> agents = Map.of();

	public ServerRegistry(JdbcTemplate jdbc, @Value("${AGENTS:}") String agentsEnv) {
		this.jdbc = jdbc;
		this.agentsEnv = agentsEnv;
	}

	@Override
	public void run(ApplicationArguments args) {
		bootstrapFromEnvIfEmpty();
		reload();
	}

	public Map<String, AgentEndpoint> getAgents() {
		return agents;
	}

	public void reload() {
		List<AgentEndpoint> rows = jdbc.query(
				"SELECT id, name, grpc_host, grpc_port FROM servers ORDER BY name",
				(rs, i) -> new AgentEndpoint(
						rs.getString("name"),
						rs.getString("grpc_host"),
						rs.getInt("grpc_port")));
		Map<String, AgentEndpoint> map = new LinkedHashMap<>();
		for (AgentEndpoint e : rows) {
			map.put(e.name(), e);
		}
		this.agents = Collections.unmodifiableMap(map);
	}

	public AgentEndpoint add(String name, String host, int port, String environment, String tagsJson) {
		jdbc.update(
				"""
				INSERT INTO servers (id, name, grpc_host, grpc_port, environment, tags, first_seen, last_seen)
				VALUES (?, ?, ?, ?, ?, ?::jsonb, NOW(), NOW())
				ON CONFLICT (id) DO UPDATE SET
				  grpc_host = EXCLUDED.grpc_host,
				  grpc_port = EXCLUDED.grpc_port,
				  environment = EXCLUDED.environment,
				  tags = EXCLUDED.tags,
				  last_seen = NOW()
				""",
				name, name, host, port,
				environment == null ? "" : environment,
				tagsJson == null ? "[]" : tagsJson);
		reload();
		return agents.get(name);
	}

	private void bootstrapFromEnvIfEmpty() {
		if (agentsEnv == null || agentsEnv.isBlank()) {
			return;
		}
		// Always upsert AGENTS so compose/.env changes pick up new hosts
		for (String entry : agentsEnv.split(",")) {
			String trimmed = entry.trim();
			if (trimmed.isEmpty()) continue;
			String[] parts = trimmed.split(":");
			if (parts.length != 3) {
				throw new IllegalArgumentException(
						"Invalid AGENTS entry '" + trimmed + "'; expected name:host:port");
			}
			add(parts[0], parts[1], Integer.parseInt(parts[2]), "compose", "[]");
		}
	}

	public record AgentEndpoint(String name, String host, int port) {
		public String target() {
			return host + ":" + port;
		}
	}
}
