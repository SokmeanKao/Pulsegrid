package com.monitoring.backend.gateway;

import com.monitoring.backend.enrollment.EnrollmentService;
import com.monitoring.backend.grpc.gen.AgentGatewayGrpc;
import com.monitoring.backend.grpc.gen.AgentHello;
import com.monitoring.backend.grpc.gen.AgentMessage;
import com.monitoring.backend.grpc.gen.MetricsEnvelope;
import com.monitoring.backend.grpc.gen.MonitorMessage;
import com.monitoring.backend.grpc.gen.Reject;
import com.monitoring.backend.grpc.gen.Welcome;
import com.monitoring.backend.history.HistoryWriter;
import com.monitoring.backend.live.LiveStateCache;
import com.monitoring.backend.metrics.EnvelopeMapper;
import com.monitoring.backend.metrics.MetricsEnvelopeDto;
import com.monitoring.backend.metrics.MetricsHub;
import com.monitoring.backend.registry.ServerRegistry;
import io.grpc.stub.StreamObserver;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class AgentGatewayService extends AgentGatewayGrpc.AgentGatewayImplBase {

	private static final Logger log = LoggerFactory.getLogger(AgentGatewayService.class);

	private final EnrollmentService enrollmentService;
	private final ServerRegistry serverRegistry;
	private final AgentSessionRegistry sessions;
	private final MetricsHub hub;
	private final LiveStateCache liveStateCache;
	private final HistoryWriter historyWriter;

	public AgentGatewayService(
			EnrollmentService enrollmentService,
			ServerRegistry serverRegistry,
			AgentSessionRegistry sessions,
			MetricsHub hub,
			LiveStateCache liveStateCache,
			HistoryWriter historyWriter) {
		this.enrollmentService = enrollmentService;
		this.serverRegistry = serverRegistry;
		this.sessions = sessions;
		this.hub = hub;
		this.liveStateCache = liveStateCache;
		this.historyWriter = historyWriter;
	}

	@Override
	public StreamObserver<AgentMessage> connect(StreamObserver<MonitorMessage> responseObserver) {
		return new StreamObserver<>() {
			private String serverId;
			private boolean welcomed;

			@Override
			public void onNext(AgentMessage message) {
				try {
					if (!welcomed) {
						handleHello(message, responseObserver);
						return;
					}
					switch (message.getPayloadCase()) {
						case METRICS -> handleMetrics(message.getMetrics());
						case HEARTBEAT -> serverRegistry.touchLastSeen(serverId);
						case COMMAND_RESULT, HELLO, PAYLOAD_NOT_SET -> {
							/* ignore reserved / unexpected after welcome */
						}
					}
				} catch (Exception e) {
					log.warn("Agent stream error for {}: {}", serverId, e.toString());
					reject(responseObserver, "INTERNAL", e.getMessage());
				}
			}

			private void handleHello(AgentMessage message, StreamObserver<MonitorMessage> out) {
				if (message.getPayloadCase() != AgentMessage.PayloadCase.HELLO) {
					reject(out, "EXPECTED_HELLO", "First message must be HELLO");
					return;
				}
				AgentHello hello = message.getHello();
				String id = hello.getServerId().trim();
				if (id.isEmpty()) {
					reject(out, "INVALID_SERVER_ID", "server_id is required");
					return;
				}

				boolean registered = serverRegistry.isRegistered(id);
				if (!registered) {
					if (!enrollmentService.validateAndConsume(id, hello.getJoinToken())) {
						reject(out, "INVALID_TOKEN", "Join token invalid, expired, or already used");
						return;
					}
				}

				String remote = GatewayPeer.remoteAddress();
				serverRegistry.upsertFromHello(
						id,
						hello.getHostname(),
						hello.getOs(),
						hello.getArch(),
						hello.getAgentVersion(),
						remote);

				AgentSessionRegistry.Session previous = sessions.put(id, out);
				if (previous != null && previous.outbound() != out) {
					try {
						previous.outbound().onCompleted();
					} catch (Exception ignored) {
						/* old session already closed */
					}
					liveStateCache.markDisconnected(id);
					log.info("Replaced existing session for {}", id);
				}

				serverId = id;
				welcomed = true;
				out.onNext(MonitorMessage.newBuilder()
						.setWelcome(Welcome.newBuilder()
								.setAccepted(true)
								.setHeartbeatIntervalSeconds(10)
								.setMetricsIntervalSeconds(2)
								.build())
						.build());
				log.info("Agent {} welcomed from {}", id, remote);
			}

			private void handleMetrics(MetricsEnvelope envelope) {
				if (serverId == null) {
					return;
				}
				MetricsEnvelopeDto dto = EnvelopeMapper.toDto(envelope);
				liveStateCache.upsertSample(dto, true);
				hub.publish(dto);
				historyWriter.writeAsync(dto);
				serverRegistry.touchLastSeen(serverId);
			}

			@Override
			public void onError(Throwable t) {
				cleanup("error: " + t);
			}

			@Override
			public void onCompleted() {
				cleanup("completed");
				try {
					responseObserver.onCompleted();
				} catch (Exception ignored) {
					/* already closed */
				}
			}

			private void cleanup(String reason) {
				if (serverId != null) {
					sessions.remove(serverId, responseObserver);
					liveStateCache.markDisconnected(serverId);
					log.info("Agent {} disconnected ({})", serverId, reason);
				}
			}
		};
	}

	private static void reject(StreamObserver<MonitorMessage> out, String code, String message) {
		try {
			out.onNext(MonitorMessage.newBuilder()
					.setReject(Reject.newBuilder().setCode(code).setMessage(message == null ? "" : message).build())
					.build());
			out.onCompleted();
		} catch (Exception e) {
			out.onError(e);
		}
	}
}
