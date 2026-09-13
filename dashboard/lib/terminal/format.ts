export function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

export function asciiBar(pct: number, width = 24): string {
  const filled = Math.round((clampPct(pct) / 100) * width);
  return `${"█".repeat(filled)}${"░".repeat(width - filled)}`;
}

export function formatBytes(n: number): string {
  const abs = Math.abs(n);
  if (abs < 1024) return `${n.toFixed(0)} B`;
  if (abs < 1024 ** 2) return `${(n / 1024).toFixed(1)} K`;
  if (abs < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} M`;
  return `${(n / 1024 ** 3).toFixed(2)} G`;
}

export function formatBitsPerSec(bytesPerSec: number): string {
  const bits = bytesPerSec * 8;
  if (bits < 1000) return `${bits.toFixed(0)} b/s`;
  if (bits < 1_000_000) return `${(bits / 1000).toFixed(2)} Kb/s`;
  if (bits < 1_000_000_000) return `${(bits / 1_000_000).toFixed(2)} Mb/s`;
  return `${(bits / 1_000_000_000).toFixed(2)} Gb/s`;
}

export function formatMb(n: number): string {
  if (n >= 1024) return `${(n / 1024).toFixed(1)}G`;
  return `${n.toFixed(0)}M`;
}

export function clockNow(): string {
  return new Date().toLocaleTimeString(undefined, { hour12: false });
}
