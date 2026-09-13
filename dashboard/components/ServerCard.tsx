"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import * as echarts from "echarts";
import {
  Activity,
  Cpu,
  HardDrive,
  MemoryStick,
  Wifi,
} from "lucide-react";
import { useMetricsSocket } from "@/lib/useMetricsSocket";
import type { MetricsEnvelope } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  GridDragHandle,
  GridStackBoard,
  type GridItemSpec,
} from "@/components/grid/GridStackBoard";

type Props = {
  serverId: string;
};

const GUI_LAYOUT_KEY = "pulsegrid.grid.gui.server";

const GUI_DEFAULTS: GridItemSpec[] = [
  { id: "metrics", x: 0, y: 0, w: 12, h: 4, minW: 4, minH: 3 },
  { id: "trend", x: 0, y: 4, w: 8, h: 6, minW: 4, minH: 4 },
  { id: "disk", x: 8, y: 4, w: 4, h: 6, minW: 3, minH: 3 },
];

function latest(points: MetricsEnvelope[]): MetricsEnvelope | undefined {
  return points[points.length - 1];
}

function pct(used: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, (used / total) * 100);
}

function memPressure(m: MetricsEnvelope["memory"]): number {
  if (!m || m.totalMb <= 0) return 0;
  const unavailable = m.totalMb - m.availableMb;
  return Math.min(100, (unavailable / m.totalMb) * 100);
}

export function ServerCard({ serverId }: Props) {
  const { getBuffer, status } = useMetricsSocket();
  const seriesRef = useRef<HTMLDivElement>(null);
  const seriesChart = useRef<echarts.ECharts | null>(null);
  const [snap, setSnap] = useState<{
    cpu: number;
    mem: number;
    disk: number;
    rx: number;
    tx: number;
    hostname?: string;
  } | null>(null);

  const resizeCharts = useCallback(() => {
    seriesChart.current?.resize();
  }, []);

  useEffect(() => {
    if (!seriesRef.current) return;

    seriesChart.current = echarts.init(seriesRef.current, undefined, {
      renderer: "canvas",
    });

    const onResize = () => seriesChart.current?.resize();
    window.addEventListener("resize", onResize);

    const timer = window.setInterval(() => {
      const points = getBuffer(serverId) as MetricsEnvelope[];
      const last = latest(points);
      if (!last?.cpu || !last.memory) {
        setSnap(null);
        return;
      }

      const diskPct = Math.max(
        0,
        ...(last.disks ?? []).map((d) => pct(d.usedGb, d.totalGb)),
      );
      const rx = (last.networks ?? []).reduce(
        (s, n) => s + (n.rxBytesPerSec || 0),
        0,
      );
      const tx = (last.networks ?? []).reduce(
        (s, n) => s + (n.txBytesPerSec || 0),
        0,
      );

      setSnap({
        cpu: last.cpu.usagePercent,
        mem: memPressure(last.memory),
        disk: diskPct,
        rx,
        tx,
        hostname: last.host?.hostname,
      });

      const times = points.map((p) =>
        new Date(p.collectedAtUnixMs).toLocaleTimeString(),
      );
      seriesChart.current?.setOption(
        {
          animation: false,
          grid: { left: 40, right: 16, top: 36, bottom: 28 },
          legend: {
            data: ["CPU %", "Mem pressure %"],
            textStyle: { color: "#64748b", fontFamily: "Maven Pro" },
          },
          xAxis: {
            type: "category",
            data: times,
            axisLabel: { color: "#94a3b8", fontSize: 10 },
          },
          yAxis: {
            type: "value",
            min: 0,
            max: 100,
            axisLabel: { color: "#94a3b8", fontSize: 10 },
            splitLine: { lineStyle: { color: "#e2e8f0" } },
          },
          series: [
            {
              name: "CPU %",
              type: "line",
              showSymbol: false,
              data: points.map((p) =>
                Number((p.cpu?.usagePercent ?? 0).toFixed(2)),
              ),
              lineStyle: { color: "#10b981", width: 2 },
              areaStyle: { color: "rgba(16,185,129,0.12)" },
            },
            {
              name: "Mem pressure %",
              type: "line",
              showSymbol: false,
              data: points.map((p) =>
                Number(memPressure(p.memory).toFixed(2)),
              ),
              lineStyle: { color: "#3b82f6", width: 2 },
            },
          ],
        },
        { lazyUpdate: true },
      );
    }, 500);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("resize", onResize);
      seriesChart.current?.dispose();
      seriesChart.current = null;
    };
  }, [getBuffer, serverId]);

  const live = status === "connected";

  return (
    <GridStackBoard
      storageKey={GUI_LAYOUT_KEY}
      defaults={GUI_DEFAULTS}
      onLayout={resizeCharts}
      className="min-h-[520px]"
    >
      <Card data-grid-id="metrics" className="h-full">
        <CardHeader className="flex-row items-start justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <GridDragHandle className="text-slate-400" />
              <Activity className="h-5 w-5 text-emerald-600" />
              {serverId}
            </CardTitle>
            <CardDescription className="mt-1">
              {snap?.hostname ? `${snap.hostname} · ` : ""}
              Drag ⠿ to rearrange · resize from edges
            </CardDescription>
          </div>
          <Badge variant={live ? "success" : "destructive"}>
            {live ? "live" : "stale"}
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricTile
              icon={<Cpu className="h-4 w-4 text-emerald-600" />}
              label="CPU"
              value={snap ? `${snap.cpu.toFixed(1)}%` : "—"}
              accent="emerald"
            />
            <MetricTile
              icon={<MemoryStick className="h-4 w-4 text-blue-600" />}
              label="Memory"
              value={snap ? `${snap.mem.toFixed(1)}%` : "—"}
              accent="blue"
            />
            <MetricTile
              icon={<HardDrive className="h-4 w-4 text-violet-600" />}
              label="Disk"
              value={snap ? `${snap.disk.toFixed(1)}%` : "—"}
              accent="violet"
            />
            <MetricTile
              icon={<Wifi className="h-4 w-4 text-amber-600" />}
              label="Network"
              value={
                snap
                  ? `${formatRate(snap.rx)}↓ / ${formatRate(snap.tx)}↑`
                  : "—"
              }
              accent="amber"
            />
          </div>
        </CardContent>
      </Card>

      <Card data-grid-id="trend" className="flex h-full flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <GridDragHandle className="text-slate-400" />
            CPU & memory trend
          </CardTitle>
          <CardDescription>Last ~2 minutes of live samples</CardDescription>
        </CardHeader>
        <CardContent className="min-h-0 flex-1">
          <div ref={seriesRef} className="h-full min-h-[180px] w-full" />
        </CardContent>
      </Card>

      <Card data-grid-id="disk" className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <GridDragHandle className="text-slate-400" />
            <HardDrive className="h-4 w-4 text-violet-600" />
            Disk usage
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-sm text-slate-600">
            <span>Hottest mount</span>
            <span className="tabular-nums font-medium text-slate-900">
              {snap ? `${snap.disk.toFixed(1)}%` : "—"}
            </span>
          </div>
          <Progress
            value={snap?.disk ?? 0}
            className="h-2 bg-violet-100 [&>div]:bg-violet-500"
          />
          <Separator />
          <p className="text-xs text-slate-500">
            Layout saved in this browser (localStorage).
          </p>
        </CardContent>
      </Card>
    </GridStackBoard>
  );
}

function MetricTile({
  icon,
  label,
  value,
  accent,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  accent: "emerald" | "blue" | "violet" | "amber";
}) {
  const accents = {
    emerald: "border-emerald-200 bg-emerald-50/60",
    blue: "border-blue-200 bg-blue-50/60",
    violet: "border-violet-200 bg-violet-50/60",
    amber: "border-amber-200 bg-amber-50/60",
  };
  return (
    <div className={`rounded-lg border p-3 ${accents[accent]}`}>
      <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
        {icon}
        {label}
      </div>
      <div className="text-lg font-semibold tabular-nums text-slate-900">
        {value}
      </div>
    </div>
  );
}

function formatRate(bytesPerSec: number): string {
  const bits = bytesPerSec * 8;
  if (bits < 1000) return `${bits.toFixed(0)} bps`;
  if (bits < 1_000_000) return `${(bits / 1000).toFixed(1)} Kbps`;
  return `${(bits / 1_000_000).toFixed(1)} Mbps`;
}
