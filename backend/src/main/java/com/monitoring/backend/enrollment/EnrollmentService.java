package com.monitoring.backend.enrollment;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.UUID;

@Service
public class EnrollmentService {

	private final JdbcTemplate jdbc;
	private final SecureRandom random = new SecureRandom();

	public EnrollmentService(JdbcTemplate jdbc) {
		this.jdbc = jdbc;
	}

	public record CreateResult(String serverId, String token, Instant expiresAt) {}

	public CreateResult create(String serverId, Duration ttl) {
		if (serverId == null || serverId.isBlank()) {
			throw new IllegalArgumentException("serverId is required");
		}
		String id = serverId.trim();
		byte[] bytes = new byte[24];
		random.nextBytes(bytes);
		String token = "pg_join_" + Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
		Instant expiresAt = Instant.now().plus(ttl == null ? Duration.ofHours(24) : ttl);
		jdbc.update(
				"""
				INSERT INTO enrollment_tokens (id, server_id, token_hash, expires_at, created_by)
				VALUES (?::uuid, ?, ?, ?, 'ui')
				""",
				UUID.randomUUID().toString(),
				id,
				sha256Hex(token),
				java.sql.Timestamp.from(expiresAt));
		return new CreateResult(id, token, expiresAt);
	}

	public boolean validateAndConsume(String serverId, String tokenPlain) {
		if (serverId == null || serverId.isBlank() || tokenPlain == null || tokenPlain.isBlank()) {
			return false;
		}
		String hash = sha256Hex(tokenPlain.trim());
		int updated = jdbc.update(
				"""
				UPDATE enrollment_tokens
				SET used_at = NOW()
				WHERE server_id = ?
				  AND token_hash = ?
				  AND used_at IS NULL
				  AND expires_at > NOW()
				""",
				serverId.trim(),
				hash);
		return updated == 1;
	}

	public boolean isRegistered(String serverId) {
		if (serverId == null || serverId.isBlank()) {
			return false;
		}
		Integer n = jdbc.queryForObject(
				"SELECT COUNT(*) FROM servers WHERE id = ?",
				Integer.class,
				serverId.trim());
		return n != null && n > 0;
	}

	static String sha256Hex(String value) {
		try {
			MessageDigest md = MessageDigest.getInstance("SHA-256");
			byte[] digest = md.digest(value.getBytes(StandardCharsets.UTF_8));
			return HexFormat.of().formatHex(digest);
		} catch (Exception e) {
			throw new IllegalStateException("SHA-256 unavailable", e);
		}
	}
}
