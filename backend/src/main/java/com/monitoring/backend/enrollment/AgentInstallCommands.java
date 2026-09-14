package com.monitoring.backend.enrollment;

import java.util.LinkedHashMap;
import java.util.Map;

public final class AgentInstallCommands {

	private AgentInstallCommands() {}

	public static Map<String, String> build(
			String serverId,
			String monitorAddress,
			String token,
			String caUrl,
			String agentVersion) {
		String ver = (agentVersion == null || agentVersion.isBlank()) ? "v2.3.3" : agentVersion.trim();
		String linux = String.format(
				"sudo mkdir -p /etc/pulsegrid && sudo curl -fsSL %s -o /etc/pulsegrid/ca.crt && "
						+ "curl -fsSL https://raw.githubusercontent.com/SokmeanKao/Pulsegrid/main/scripts/install-agent.sh "
						+ "| sudo bash -s -- --server-id %s --monitor %s --token %s --ca /etc/pulsegrid/ca.crt --version %s",
				caUrl,
				serverId,
				monitorAddress,
				token,
				ver);
		String gitBash = String.format(
				"mkdir -p /c/pulsegrid && curl -fsSL %s -o /c/pulsegrid/ca.crt && "
						+ "curl -fL https://github.com/SokmeanKao/Pulsegrid/releases/download/%s/pulsegrid-agent-windows-amd64.exe "
						+ "-o /c/pulsegrid/pulsegrid-agent.exe && "
						+ "export SERVER_ID=%s MONITOR_ADDRESS=%s JOIN_TOKEN='%s' MONITOR_CA_FILE=/c/pulsegrid/ca.crt && "
						+ "/c/pulsegrid/pulsegrid-agent.exe",
				caUrl,
				ver,
				serverId,
				monitorAddress,
				token);
		String ps = String.format(
				"New-Item -ItemType Directory -Force -Path C:\\pulsegrid | Out-Null; "
						+ "Invoke-WebRequest -Uri %s -OutFile C:\\pulsegrid\\ca.crt; "
						+ "Invoke-WebRequest -Uri https://github.com/SokmeanKao/Pulsegrid/releases/download/%s/pulsegrid-agent-windows-amd64.exe "
						+ "-OutFile C:\\pulsegrid\\pulsegrid-agent.exe; "
						+ "$env:SERVER_ID='%s'; $env:MONITOR_ADDRESS='%s'; $env:JOIN_TOKEN='%s'; "
						+ "$env:MONITOR_CA_FILE='C:\\pulsegrid\\ca.crt'; C:\\pulsegrid\\pulsegrid-agent.exe",
				caUrl,
				ver,
				serverId,
				monitorAddress,
				token);
		String docker = String.format(
				"docker run -d --name pulsegrid-agent-%s "
						+ "-e SERVER_ID=%s -e MONITOR_ADDRESS=%s -e JOIN_TOKEN=%s "
						+ "-e MONITOR_CA_FILE=/certs/ca.crt "
						+ "-v ${PWD}/ca.crt:/certs/ca.crt:ro "
						+ "ghcr.io/sokmeankao/pulsegrid-agent:%s",
				serverId,
				serverId,
				monitorAddress,
				token,
				ver);
		Map<String, String> out = new LinkedHashMap<>();
		out.put("linux", linux);
		out.put("windowsGitBash", gitBash);
		out.put("windowsPowerShell", ps);
		out.put("docker", docker);
		return out;
	}

	public static String publicHttpBase(String advertiseHost, int httpPort) {
		String host = (advertiseHost == null || advertiseHost.isBlank()) ? "localhost" : advertiseHost.trim();
		int port = httpPort <= 0 ? 8080 : httpPort;
		if (port == 80) {
			return "http://" + host;
		}
		return "http://" + host + ":" + port;
	}
}
