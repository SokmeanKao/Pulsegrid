package com.monitoring.backend.gateway;

import io.grpc.Server;
import io.grpc.netty.shaded.io.grpc.netty.GrpcSslContexts;
import io.grpc.netty.shaded.io.grpc.netty.NettyServerBuilder;
import io.grpc.netty.shaded.io.netty.handler.ssl.SslContext;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.io.File;
import java.util.concurrent.TimeUnit;

@Component
@Order(2)
public class GrpcGatewayServer implements ApplicationRunner {

	private static final Logger log = LoggerFactory.getLogger(GrpcGatewayServer.class);

	private final AgentGatewayService agentGatewayService;
	private final AgentSessionRegistry sessions;
	private final int port;
	private final File certFile;
	private final File keyFile;
	private Server server;

	public GrpcGatewayServer(
			AgentGatewayService agentGatewayService,
			AgentSessionRegistry sessions,
			@Value("${GATEWAY_PORT:50051}") int port,
			@Value("${GATEWAY_TLS_CERT:certs/server.crt}") String certPath,
			@Value("${GATEWAY_TLS_KEY:certs/server.key}") String keyPath) {
		this.agentGatewayService = agentGatewayService;
		this.sessions = sessions;
		this.port = port;
		this.certFile = new File(certPath);
		this.keyFile = new File(keyPath);
	}

	@Override
	public void run(ApplicationArguments args) throws Exception {
		if (!certFile.isFile() || !keyFile.isFile()) {
			throw new IllegalStateException(
					"Gateway TLS cert/key missing. Expected "
							+ certFile.getAbsolutePath()
							+ " and "
							+ keyFile.getAbsolutePath()
							+ ". Run scripts/generate-monitor-certs.sh first.");
		}
		SslContext sslContext = GrpcSslContexts.forServer(certFile, keyFile).build();
		server = NettyServerBuilder.forPort(port)
				.sslContext(sslContext)
				.intercept(GatewayPeer.interceptor())
				.addService(agentGatewayService)
				.build()
				.start();
		log.info("Agent Gateway listening on :{} (TLS), sessions={}", port, sessions.size());
	}

	@PreDestroy
	public void shutdown() throws InterruptedException {
		if (server != null) {
			server.shutdown();
			server.awaitTermination(5, TimeUnit.SECONDS);
		}
	}
}
