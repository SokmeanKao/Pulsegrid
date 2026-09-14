package com.monitoring.backend.web;

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

	@GetMapping("/pulsegrid-config")
	public ResponseEntity<Map<String, Object>> config() {
		return ResponseEntity.ok(Map.of(
				"sameOrigin", sameOrigin,
				"apiUrl", apiUrl == null ? "" : apiUrl.trim(),
				"wsUrl", wsUrl == null ? "" : wsUrl.trim(),
				"backendPort", ""));
	}
}
