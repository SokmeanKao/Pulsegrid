package com.monitoring.backend;

import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
@Disabled("Requires TimescaleDB; covered by Compose e2e")
class BackendApplicationTests {

	@Test
	void contextLoads() {
	}

}
