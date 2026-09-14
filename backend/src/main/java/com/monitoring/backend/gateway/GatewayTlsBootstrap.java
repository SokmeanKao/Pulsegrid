package com.monitoring.backend.gateway;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * Ensures Gateway TLS material exists before {@link GrpcGatewayServer} starts.
 * Uses openssl when present (same layout as monitor/docker-entrypoint.sh).
 */
@Component
@Order(1)
public class GatewayTlsBootstrap implements ApplicationRunner {

	private static final Logger log = LoggerFactory.getLogger(GatewayTlsBootstrap.class);

	private final Path certDir;
	private final Path certFile;
	private final Path keyFile;
	private final Path caCertFile;
	private final Path caKeyFile;
	private final String advertiseHost;

	public GatewayTlsBootstrap(
			@Value("${GATEWAY_CERT_DIR:certs}") String certDir,
			@Value("${GATEWAY_TLS_CERT:}") String certPath,
			@Value("${GATEWAY_TLS_KEY:}") String keyPath,
			@Value("${GATEWAY_CA_CERT:}") String caCertPath,
			@Value("${GATEWAY_ADVERTISE_HOST:localhost}") String advertiseHost) {
		this.certDir = Path.of(certDir);
		this.certFile = Path.of(blankTo(certPath, certDir + "/server.crt"));
		this.keyFile = Path.of(blankTo(keyPath, certDir + "/server.key"));
		this.caCertFile = Path.of(blankTo(caCertPath, certDir + "/ca.crt"));
		this.caKeyFile = this.certDir.resolve("ca.key");
		this.advertiseHost = advertiseHost == null || advertiseHost.isBlank() ? "localhost" : advertiseHost;
	}

	private static String blankTo(String value, String fallback) {
		return value == null || value.isBlank() ? fallback : value;
	}

	@Override
	public void run(ApplicationArguments args) throws Exception {
		if (Files.isRegularFile(certFile) && Files.isRegularFile(keyFile) && Files.isRegularFile(caCertFile)) {
			log.info("Using existing Gateway TLS material under {}", certDir.toAbsolutePath());
			return;
		}
		Files.createDirectories(certDir);
		if (!opensslAvailable()) {
			throw new IllegalStateException(
					"Gateway TLS cert/key missing at "
							+ certFile.toAbsolutePath()
							+ " / "
							+ keyFile.toAbsolutePath()
							+ " and openssl is not available to auto-generate them.");
		}
		log.info("Generating Gateway TLS for SAN={} in {}", advertiseHost, certDir.toAbsolutePath());
		runOpenssl("genrsa", "-out", caKeyFile.toString(), "4096");
		runOpenssl(
				"req",
				"-x509",
				"-new",
				"-nodes",
				"-key",
				caKeyFile.toString(),
				"-sha256",
				"-days",
				"3650",
				"-subj",
				"/CN=Pulsegrid Local CA",
				"-out",
				caCertFile.toString());
		runOpenssl("genrsa", "-out", keyFile.toString(), "2048");
		Path csr = certDir.resolve("server.csr");
		runOpenssl("req", "-new", "-key", keyFile.toString(), "-subj", "/CN=" + advertiseHost, "-out", csr.toString());

		String san = "DNS:localhost,IP:127.0.0.1";
		if (advertiseHost.matches("\\d+\\.\\d+\\.\\d+\\.\\d+")) {
			san = san + ",IP:" + advertiseHost;
		} else {
			san = san + ",DNS:" + advertiseHost;
		}
		Path ext = certDir.resolve("san.ext");
		Files.writeString(ext, "subjectAltName=" + san + "\nextendedKeyUsage=serverAuth\n", StandardCharsets.US_ASCII);
		runOpenssl(
				"x509",
				"-req",
				"-in",
				csr.toString(),
				"-CA",
				caCertFile.toString(),
				"-CAkey",
				caKeyFile.toString(),
				"-CAcreateserial",
				"-out",
				certFile.toString(),
				"-days",
				"825",
				"-sha256",
				"-extfile",
				ext.toString());
		Files.deleteIfExists(csr);
		Files.deleteIfExists(ext);
		Files.deleteIfExists(certDir.resolve("ca.srl"));
		log.info("Wrote Gateway TLS material under {}", certDir.toAbsolutePath());
	}

	private static boolean opensslAvailable() {
		try {
			Process p = new ProcessBuilder("openssl", "version").redirectErrorStream(true).start();
			boolean finished = p.waitFor(10, TimeUnit.SECONDS);
			return finished && p.exitValue() == 0;
		} catch (Exception e) {
			return false;
		}
	}

	private static void runOpenssl(String... args) throws IOException, InterruptedException {
		List<String> cmd = new ArrayList<>();
		cmd.add("openssl");
		for (String a : args) {
			cmd.add(a);
		}
		ProcessBuilder pb = new ProcessBuilder(cmd);
		pb.redirectErrorStream(true);
		Process p = pb.start();
		String out = new String(p.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
		boolean finished = p.waitFor(120, TimeUnit.SECONDS);
		if (!finished) {
			p.destroyForcibly();
			throw new IllegalStateException("openssl timed out: " + String.join(" ", args));
		}
		if (p.exitValue() != 0) {
			throw new IllegalStateException("openssl failed (" + p.exitValue() + "): " + out.trim());
		}
	}
}
