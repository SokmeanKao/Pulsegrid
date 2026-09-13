package com.monitoring.backend.metrics;

import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Sinks;

@Component
public class MetricsHub {

	private final Sinks.Many<MetricsEnvelopeDto> sink =
			Sinks.many().multicast().onBackpressureBuffer(512, false);

	public void publish(MetricsEnvelopeDto message) {
		sink.tryEmitNext(message);
	}

	public Flux<MetricsEnvelopeDto> stream() {
		return sink.asFlux();
	}
}
