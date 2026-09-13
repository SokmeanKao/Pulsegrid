package com.monitoring.backend.ws;

import com.monitoring.backend.metrics.MetricsEnvelopeDto;
import com.monitoring.backend.metrics.MetricsHub;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import reactor.core.Disposable;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class MetricsWebSocketHandler extends TextWebSocketHandler {

	private static final Logger log = LoggerFactory.getLogger(MetricsWebSocketHandler.class);

	private final MetricsHub hub;
	private final ObjectMapper objectMapper;
	private final Map<String, SessionSub> sessions = new ConcurrentHashMap<>();
	private Disposable subscription;

	public MetricsWebSocketHandler(MetricsHub hub, ObjectMapper objectMapper) {
		this.hub = hub;
		this.objectMapper = objectMapper;
	}

	@PostConstruct
	public void subscribeHub() {
		subscription = hub.stream().subscribe(this::broadcast);
	}

	@Override
	public void afterConnectionEstablished(WebSocketSession session) {
		// Default: receive all until client sends a subscribe filter.
		sessions.put(session.getId(), new SessionSub(session, Set.of(), true));
		log.info("WebSocket connected: {}", session.getId());
	}

	@Override
	protected void handleTextMessage(WebSocketSession session, TextMessage message) {
		try {
			JsonNode root = objectMapper.readTree(message.getPayload());
			String type = text(root, "type");
			if (!"subscribe".equals(type)) {
				return;
			}
			boolean all = "all".equalsIgnoreCase(text(root, "mode"));
			Set<String> servers = new HashSet<>();
			JsonNode arr = root.get("servers");
			if (arr != null && arr.isArray()) {
				arr.forEach(n -> {
					String id = n == null ? "" : n.asString();
					if (!id.isBlank()) {
						servers.add(id);
					}
				});
			}
			if (!all && servers.isEmpty()) {
				all = true;
			}
			sessions.put(session.getId(), new SessionSub(session, servers, all));
			log.info("WS {} subscribe all={} servers={}", session.getId(), all, servers);
		} catch (Exception e) {
			log.warn("Bad WS control message from {}: {}", session.getId(), e.toString());
		}
	}

	private static String text(JsonNode root, String field) {
		JsonNode n = root.get(field);
		return n == null || n.isNull() ? "" : n.asString();
	}

	@Override
	public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
		sessions.remove(session.getId());
		log.info("WebSocket closed: {} ({})", session.getId(), status);
	}

	private void broadcast(MetricsEnvelopeDto message) {
		final String json;
		try {
			json = objectMapper.writeValueAsString(message);
		} catch (RuntimeException e) {
			log.error("Failed to serialize metrics", e);
			return;
		}
		TextMessage payload = new TextMessage(json);
		for (SessionSub sub : sessions.values()) {
			if (!sub.matches(message.serverId())) {
				continue;
			}
			WebSocketSession session = sub.session();
			if (!session.isOpen()) {
				sessions.remove(session.getId());
				continue;
			}
			try {
				synchronized (session) {
					session.sendMessage(payload);
				}
			} catch (IOException e) {
				log.warn("Failed to send to {}: {}", session.getId(), e.toString());
				sessions.remove(session.getId());
			}
		}
	}

	private record SessionSub(WebSocketSession session, Set<String> servers, boolean all) {
		boolean matches(String serverId) {
			return all || servers.contains(serverId);
		}

		SessionSub {
			servers = servers == null ? Set.of() : Set.copyOf(servers);
		}
	}
}
