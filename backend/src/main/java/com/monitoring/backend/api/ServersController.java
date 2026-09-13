package com.monitoring.backend.api;

import com.monitoring.backend.history.HistoryWriter;
import com.monitoring.backend.live.LiveStateCache;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class ServersController {

	private final LiveStateCache liveStateCache;
	private final HistoryWriter historyWriter;

	public ServersController(LiveStateCache liveStateCache, HistoryWriter historyWriter) {
		this.liveStateCache = liveStateCache;
		this.historyWriter = historyWriter;
	}

	@GetMapping("/servers")
	public List<Map<String, Object>> list() {
		return liveStateCache.all().stream().map(state -> {
			Map<String, Object> row = new LinkedHashMap<>();
			row.put("serverId", state.serverId());
			row.put("connection", state.connection().name());
			row.put("health", state.health().name());
			row.put("lastSeen", state.lastSeen() == null ? null : state.lastSeen().toString());
			row.put("latest", state.latest());
			return row;
		}).toList();
	}

	@GetMapping("/servers/{id}/metrics")
	public List<Map<String, Object>> history(
			@PathVariable("id") String id,
			@RequestParam(value = "from", required = false) Long fromMs,
			@RequestParam(value = "to", required = false) Long toMs,
			@RequestParam(value = "limit", defaultValue = "500") int limit) {
		Instant to = toMs == null ? Instant.now() : Instant.ofEpochMilli(toMs);
		Instant from = fromMs == null ? to.minusSeconds(3600) : Instant.ofEpochMilli(fromMs);
		return historyWriter.query(id, from, to, Math.min(limit, 5000));
	}
}
