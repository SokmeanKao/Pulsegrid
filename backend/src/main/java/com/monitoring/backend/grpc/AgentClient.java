package com.monitoring.backend.grpc;

import com.monitoring.backend.grpc.gen.MetricsEnvelope;
import com.monitoring.backend.grpc.gen.MetricsRequest;
import com.monitoring.backend.grpc.gen.PulsegridServiceGrpc;
import com.monitoring.backend.history.HistoryWriter;
import com.monitoring.backend.live.LiveStateCache;
import com.monitoring.backend.metrics.EnvelopeMapper;
import com.monitoring.backend.metrics.MetricsEnvelopeDto;
import com.monitoring.backend.metrics.MetricsHub;
import com.monitoring.backend.registry.ServerRegistry;
import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder;
import io.grpc.stub.StreamObserver;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

@Component
@Order(2)
public class AgentClient implements ApplicationRunner {

	private static final Logger log = LoggerFactory.getLogger(AgentClient.class);

	private final ServerRegistry registry;
	private final MetricsHub hub;
	private final LiveStateCache liveStateCache;
	private final HistoryWriter historyWriter;
	private final Map<String, AtomicBoolean> connected = new ConcurrentHashMap<>();
	private final Map<String, ManagedChannel> channels = new ConcurrentHashMap<>();
	private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(2);
	private final AtomicBoolean running = new AtomicBoolean(true);

	public AgentClient(
			ServerRegistry registry,
			MetricsHub hub,
			LiveStateCache liveStateCache,
			HistoryWriter historyWriter) {
		this.registry = registry;
		this.hub = hub;
		this.liveStateCache = liveStateCache;
		this.historyWriter = historyWriter;
	}

	@Override
	public void run(ApplicationArguments args) {
		for (ServerRegistry.AgentEndpoint agent : registry.getAgents().values()) {
			connected.put(agent.name(), new AtomicBoolean(false));
			scheduleConnect(agent, 0);
		}
		if (registry.getAgents().isEmpty()) {
			log.warn("No agents configured; set AGENTS=name:host:port,... or add via /api/servers");
		}
	}

	public Map<String, String> connectionStatus() {
		Map<String, String> status = new ConcurrentHashMap<>();
		connected.forEach((name, flag) ->
				status.put(name, flag.get() ? "connected" : "disconnected"));
		return status;
	}

	private void scheduleConnect(ServerRegistry.AgentEndpoint agent, long delaySeconds) {
		if (!running.get()) {
			return;
		}
		scheduler.schedule(() -> connect(agent, Math.max(1, delaySeconds)), delaySeconds, TimeUnit.SECONDS);
	}

	private void connect(ServerRegistry.AgentEndpoint agent, long currentBackoffSeconds) {
		if (!running.get()) {
			return;
		}
		ManagedChannel previous = channels.remove(agent.name());
		if (previous != null) {
			previous.shutdownNow();
		}

		ManagedChannel channel = ManagedChannelBuilder.forAddress(agent.host(), agent.port())
				.usePlaintext()
				.build();
		channels.put(agent.name(), channel);

		PulsegridServiceGrpc.PulsegridServiceStub stub = PulsegridServiceGrpc.newStub(channel);
		log.info("Connecting StreamMetrics to agent {} at {}", agent.name(), agent.target());

		stub.streamMetrics(MetricsRequest.getDefaultInstance(), new StreamObserver<>() {
			@Override
			public void onNext(MetricsEnvelope value) {
				connected.get(agent.name()).set(true);
				MetricsEnvelopeDto dto = EnvelopeMapper.toDto(value);
				liveStateCache.upsertSample(dto, true);
				hub.publish(dto);
				historyWriter.writeAsync(dto);
			}

			@Override
			public void onError(Throwable t) {
				connected.get(agent.name()).set(false);
				liveStateCache.markDisconnected(agent.name());
				log.warn("Stream to {} failed: {}", agent.name(), t.toString());
				long next = Math.min(30, Math.max(1, currentBackoffSeconds * 2));
				scheduleConnect(agent, next);
			}

			@Override
			public void onCompleted() {
				connected.get(agent.name()).set(false);
				liveStateCache.markDisconnected(agent.name());
				log.warn("Stream to {} completed; reconnecting", agent.name());
				long next = Math.min(30, Math.max(1, currentBackoffSeconds * 2));
				scheduleConnect(agent, next);
			}
		});
	}

	@PreDestroy
	public void shutdown() {
		running.set(false);
		scheduler.shutdownNow();
		channels.values().forEach(ManagedChannel::shutdownNow);
	}
}
