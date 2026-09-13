package gateway

import "testing"
import "time"

func TestNextBackoff(t *testing.T) {
	d := time.Second
	wantSeries := []time.Duration{
		time.Second,
		2 * time.Second,
		4 * time.Second,
		8 * time.Second,
		15 * time.Second,
		30 * time.Second,
		30 * time.Second,
	}
	for i, want := range wantSeries {
		if d != want {
			t.Fatalf("step %d: got %v want %v", i, d, want)
		}
		d = nextBackoff(d)
	}
}
