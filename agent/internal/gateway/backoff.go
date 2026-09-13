package gateway

import "time"

// nextBackoff matches the v2.0 reconnect series: 1s→2s→4s→8s→15s→30s→30s…
func nextBackoff(current time.Duration) time.Duration {
	if current < time.Second {
		return time.Second
	}
	switch {
	case current < 8*time.Second:
		return current * 2
	case current < 15*time.Second:
		return 15 * time.Second
	default:
		return 30 * time.Second
	}
}
