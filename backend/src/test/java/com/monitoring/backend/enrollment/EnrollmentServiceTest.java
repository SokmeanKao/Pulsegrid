package com.monitoring.backend.enrollment;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class EnrollmentServiceTest {

	@Test
	void sha256IsStableHex() {
		String a = EnrollmentService.sha256Hex("pg_join_test");
		String b = EnrollmentService.sha256Hex("pg_join_test");
		assertEquals(a, b);
		assertEquals(64, a.length());
		assertFalse(a.contains(" "));
	}

	@Test
	void tokenPrefixConvention() {
		assertTrue("pg_join_abc".startsWith("pg_join_"));
	}
}
