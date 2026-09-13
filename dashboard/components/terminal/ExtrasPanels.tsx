"use client";

import type { MetricsEnvelope } from "@/lib/types";
import { AsciiProgress } from "./AsciiProgress";
import { TerminalWidget } from "./TerminalWidget";
import { useTerminalEditMode } from "./edit-mode";

type Props = {
  sample: MetricsEnvelope | null;
};

function formatUptime(sec: number): string {
  if (!sec || sec < 0) return "—";
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function DockerPanel({ sample }: Props) {
  const editMode = useTerminalEditMode();
  const docker = sample?.docker;
  const running = docker?.containersRunning ?? 0;

  return (
    <TerminalWidget
      type="docker"
      sample={sample}
      editMode={editMode}
      titleSuffix={docker?.available ? String(running) : undefined}
      emptyMessage="No Docker data"
    >
      {!docker?.available ? (
        <p className="text-[var(--t-muted)]">
          Docker unavailable
          {docker?.errorMessage ? ` — ${docker.errorMessage}` : ""}
        </p>
      ) : (
        <div className="flex h-full min-h-0 flex-col gap-2">
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] sm:grid-cols-4">
            <Stat label="Running" value={String(docker.containersRunning)} />
            <Stat label="Paused" value={String(docker.containersPaused)} />
            <Stat label="Stopped" value={String(docker.containersStopped)} />
            <Stat label="Images" value={String(docker.images)} />
          </div>
          {docker.serverVersion ? (
            <p className="text-[10px] text-[var(--t-muted)]">
              Engine {docker.serverVersion}
            </p>
          ) : null}
          <div className="min-h-0 flex-1 space-y-1 overflow-auto">
            {(docker.topContainers ?? []).length === 0 ? (
              <p className="text-[var(--t-muted)]">No running containers</p>
            ) : (
              docker.topContainers.map((c) => (
                <div key={c.id} className="space-y-0.5">
                  <div className="flex justify-between gap-2 text-[11px]">
                    <span className="truncate text-[var(--t-text)]">
                      {c.name || c.id}
                    </span>
                    <span className="shrink-0 tabular-nums text-[var(--t-muted)]">
                      {c.cpuPercent.toFixed(1)}% · {c.memoryMb.toFixed(0)}M
                    </span>
                  </div>
                  <AsciiProgress
                    label=""
                    pct={Math.min(100, c.cpuPercent)}
                    detail={`${c.cpuPercent.toFixed(1)}% · ${c.memoryMb.toFixed(0)}M`}
                    width={18}
                  />
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </TerminalWidget>
  );
}

export function HostPanel({ sample }: Props) {
  const editMode = useTerminalEditMode();
  const extras = sample?.hostExtras;

  return (
    <TerminalWidget
      type="host"
      sample={sample}
      editMode={editMode}
      emptyMessage="No host extras"
    >
      <div className="space-y-3 text-[11px]">
        <div>
          <div className="text-[10px] text-[var(--t-muted)]">UPTIME</div>
          <div className="text-lg tabular-nums text-[var(--t-info)]">
            {formatUptime(extras?.uptimeSeconds ?? 0)}
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-[10px] text-[var(--t-muted)]">LOAD</div>
          {extras?.loadAvailable ? (
            <>
              <LoadLine label="1m" value={extras.load1} />
              <LoadLine label="5m" value={extras.load5} />
              <LoadLine label="15m" value={extras.load15} />
            </>
          ) : (
            <p className="text-[var(--t-muted)]">— (not available on this OS)</p>
          )}
        </div>
        {sample?.host ? (
          <p className="text-[10px] text-[var(--t-muted)]">
            {sample.host.hostname} · {sample.host.os}/{sample.host.arch}
          </p>
        ) : null}
      </div>
    </TerminalWidget>
  );
}

export function SensorsPanel({ sample }: Props) {
  const editMode = useTerminalEditMode();
  const sensors = sample?.sensors;
  const gpus = sensors?.gpus ?? [];
  const temps = sensors?.temperatures ?? [];

  return (
    <TerminalWidget
      type="sensors"
      sample={sample}
      editMode={editMode}
      emptyMessage="No sensors detected"
    >
      <div className="space-y-3 text-[11px]">
        {gpus.length > 0 ? (
          <div className="space-y-2">
            <div className="text-[10px] text-[var(--t-muted)]">GPU</div>
            {gpus.map((g) => (
              <div key={g.name} className="space-y-0.5">
                <AsciiProgress
                  label="GPU"
                  pct={Math.min(100, g.utilizationPercent)}
                  detail={
                    g.temperatureC > 0 ? `${g.temperatureC.toFixed(0)}°C` : undefined
                  }
                  width={16}
                />
                <div className="text-[10px] text-[var(--t-muted)]">
                  {g.name} · VRAM {g.memoryUsedMb.toFixed(0)}/{g.memoryTotalMb.toFixed(0)} MB
                </div>
              </div>
            ))}
          </div>
        ) : null}
        {temps.length > 0 ? (
          <div className="space-y-1">
            <div className="text-[10px] text-[var(--t-muted)]">TEMP</div>
            {temps.map((t) => (
              <div key={t.name} className="flex justify-between gap-2">
                <span className="truncate">{t.name}</span>
                <span className="tabular-nums">{t.celsius.toFixed(1)}°C</span>
              </div>
            ))}
          </div>
        ) : null}
        {gpus.length === 0 && temps.length === 0 ? (
          <p className="text-[var(--t-muted)]">No sensors detected</p>
        ) : null}
      </div>
    </TerminalWidget>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] text-[var(--t-muted)]">{label}</div>
      <div className="tabular-nums text-[var(--t-text)]">{value}</div>
    </div>
  );
}

function LoadLine({ label, value }: { label: string; value: number }) {
  return (
    <AsciiProgress
      label={label}
      pct={Math.min(100, value * 25)}
      detail={value.toFixed(2)}
      width={16}
    />
  );
}
