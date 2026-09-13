package com.monitoring.backend.registry;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class ServerRegistry {

	private final JdbcTemplate jdbc;

	public ServerRegistry(JdbcTemplate jdbc) {
		this.jdbc = jdbc;
	}

	public boolean isRegistered(String serverId) {
		if (serverId == null || serverId.isBlank()) {
			return false;
		}
		Integer n = jdbc.queryForObject(
				"SELECT COUNT(*) FROM servers WHERE id = ?",
				Integer.class,
				serverId.trim());
		return n != null && n > 0;
	}

	public void upsertFromHello(
			String serverId,
			String hostname,
			String os,
			String arch,
			String agentVersion,
			String remoteAddr) {
		String id = serverId.trim();
		jdbc.update(
				"""
				INSERT INTO servers (
				  id, name, hostname, os, architecture, agent_version,
				  last_remote_addr, environment, tags, first_seen, last_seen
				) VALUES (?, ?, ?, ?, ?, ?, ?, '', '[]'::jsonb, NOW(), NOW())
				ON CONFLICT (id) DO UPDATE SET
				  hostname = EXCLUDED.hostname,
				  os = EXCLUDED.os,
				  architecture = EXCLUDED.architecture,
				  agent_version = EXCLUDED.agent_version,
				  last_remote_addr = EXCLUDED.last_remote_addr,
				  last_seen = NOW()
				""",
				id,
				id,
				nullToEmpty(hostname),
				nullToEmpty(os),
				nullToEmpty(arch),
				nullToEmpty(agentVersion),
				nullToEmpty(remoteAddr));
	}

	public void touchLastSeen(String serverId) {
		jdbc.update("UPDATE servers SET last_seen = NOW() WHERE id = ?", serverId);
	}

	private static String nullToEmpty(String v) {
		return v == null ? "" : v;
	}
}
