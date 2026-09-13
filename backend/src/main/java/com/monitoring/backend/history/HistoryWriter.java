package com.monitoring.backend.history;

import com.monitoring.backend.metrics.MetricsEnvelopeDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Component
public class HistoryWriter {

	private static final Logger log = LoggerFactory.getLogger(HistoryWriter.class);

	private final JdbcTemplate jdbc;
	private final ObjectMapper objectMapper;
	private final ExecutorService executor = Executors.newSingleThreadExecutor(r -> {
		Thread t = new Thread(r, "history-writer");
		t.setDaemon(true);
		return t;
	});

	public HistoryWriter(JdbcTemplate jdbc, ObjectMapper objectMapper) {
		this.jdbc = jdbc;
		this.objectMapper = objectMapper;
	}

	public void writeAsync(MetricsEnvelopeDto dto) {
		executor.execute(() -> {
			try {
				String json = objectMapper.writeValueAsString(dto);
				jdbc.update(
						"""
						INSERT INTO metric_samples (time, server_id, sequence, payload)
						VALUES (?, ?, ?, ?::jsonb)
						""",
						Timestamp.from(Instant.ofEpochMilli(dto.collectedAtUnixMs())),
						dto.serverId(),
						dto.sequence(),
						json);
				jdbc.update("UPDATE servers SET last_seen = NOW() WHERE id = ?", dto.serverId());
			} catch (Exception e) {
				log.warn("history write failed for {}: {}", dto.serverId(), e.toString());
			}
		});
	}

	public List<Map<String, Object>> query(String serverId, Instant from, Instant to, int limit) {
		return jdbc.queryForList(
				"""
				SELECT time, sequence, payload
				FROM metric_samples
				WHERE server_id = ?
				  AND time >= ?
				  AND time <= ?
				ORDER BY time ASC
				LIMIT ?
				""",
				serverId,
				Timestamp.from(from),
				Timestamp.from(to),
				limit);
	}
}
