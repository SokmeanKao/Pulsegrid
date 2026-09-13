package com.monitoring.backend.enrollment;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/agents")
public class EnrollmentController {

	private final EnrollmentService enrollmentService;
	private final String advertiseHost;
	private final int gatewayPort;
	private final Path caCertPath;

	public EnrollmentController(
			EnrollmentService enrollmentService,
			@Value("${GATEWAY_ADVERTISE_HOST:localhost}") String advertiseHost,
			@Value("${GATEWAY_PORT:50051}") int gatewayPort,
			@Value("${GATEWAY_CA_CERT:certs/ca.crt}") String caCertPath) {
		this.enrollmentService = enrollmentService;
		this.advertiseHost = advertiseHost;
		this.gatewayPort = gatewayPort;
		this.caCertPath = Path.of(caCertPath);
	}

	public record EnrollRequest(String serverId) {}

	@PostMapping("/enroll")
	public ResponseEntity<Map<String, Object>> enroll(@RequestBody EnrollRequest body) {
		var created = enrollmentService.create(body.serverId(), Duration.ofHours(24));
		String monitor = advertiseHost + ":" + gatewayPort;
		String installCommand = String.format(
				"curl -fsSL https://raw.githubusercontent.com/SokmeanKao/Pulsegrid/main/scripts/install-agent.sh "
						+ "| sudo bash -s -- --server-id %s --monitor %s --token %s --ca /etc/pulsegrid/ca.crt",
				created.serverId(),
				monitor,
				created.token());

		Map<String, Object> resp = new LinkedHashMap<>();
		resp.put("serverId", created.serverId());
		resp.put("token", created.token());
		resp.put("expiresAt", created.expiresAt().toString());
		resp.put("monitorAddress", monitor);
		resp.put("installCommand", installCommand);
		return ResponseEntity.ok(resp);
	}

	@GetMapping(value = "/ca.crt", produces = "application/x-pem-file")
	public ResponseEntity<byte[]> caCert() throws Exception {
		if (!Files.isRegularFile(caCertPath)) {
			return ResponseEntity.notFound().build();
		}
		return ResponseEntity.ok(Files.readAllBytes(caCertPath));
	}
}
