package com.monitoring.backend.web;

import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class PulsegridConfigController {

	@Value("${PULSEGRID_SAME_ORIGIN:true}")
	private boolean sameOrigin;

	@Value("${PULSEGRID_API_URL:}")
	private String apiUrl;

	@Value("${PULSEGRID_WS_URL:}")
	private String wsUrl;

	@Value("${GATEWAY_ADVERTISE_HOST:localhost}")
	private String advertiseHost;

	@Value("${GATEWAY_PORT:50051}")
	private int gatewayPort;

	@Value("${GATEWAY_HTTP_PORT:8080}")
	private int httpPort;

	@Value("${PULSEGRID_AGENT_VERSION:v2.3.3}")
	private String agentVersion;

	@GetMapping("/pulsegrid-config")
	public ResponseEntity<Map<String, Object>> config() {
		Map<String, Object> body = new LinkedHashMap<>();
		body.put("sameOrigin", sameOrigin);
		body.put("apiUrl", apiUrl == null ? "" : apiUrl.trim());
		body.put("wsUrl", wsUrl == null ? "" : wsUrl.trim());
		body.put("backendPort", "");
		body.put("advertiseHost", advertiseHost == null || advertiseHost.isBlank() ? "localhost" : advertiseHost.trim());
		body.put("gatewayPort", gatewayPort);
		body.put("httpPort", httpPort);
		body.put(
				"agentVersion",
				agentVersion == null || agentVersion.isBlank() ? "v2.3.3" : agentVersion.trim());
		return ResponseEntity.ok(body);
	}
}
