package com.monitoring.backend.enrollment;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AgentInstallCommandsTest {

	@Test
	void buildsLinuxWindowsDockerCommands() {
		Map<String, String> c = AgentInstallCommands.build(
				"kali-01",
				"192.168.0.230:50051",
				"pg_join_test",
				"http://192.168.0.230:8080/api/agents/ca.crt",
				"v2.3.3");
		assertTrue(c.get("linux").contains("--server-id kali-01"));
		assertTrue(c.get("linux").contains("pg_join_test"));
		assertTrue(c.get("linux").contains("--version v2.3.3"));
		assertTrue(c.get("windowsGitBash").contains("export SERVER_ID=kali-01"));
		assertTrue(c.get("windowsPowerShell").contains("$env:SERVER_ID"));
		assertTrue(c.get("docker").contains("ghcr.io/sokmeankao/pulsegrid-agent:v2.3.3"));
		assertTrue(c.get("docker").contains("JOIN_TOKEN=pg_join_test"));
	}

	@Test
	void publicHttpBaseOmitsPort80() {
		assertEquals("http://192.168.0.230", AgentInstallCommands.publicHttpBase("192.168.0.230", 80));
		assertEquals("http://192.168.0.230:8080", AgentInstallCommands.publicHttpBase("192.168.0.230", 8080));
	}
}
