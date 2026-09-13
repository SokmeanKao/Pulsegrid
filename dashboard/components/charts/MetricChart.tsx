"use client";

import * as echarts from "echarts";
import type { EChartsOption } from "echarts";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

type Props = {
  option: EChartsOption;
  className?: string;
  /** Fixed pixel height from layout size profile. */
  height?: number;
};

/**
 * Shared ECharts host for GridStack widgets.
 * Height comes from layout profiles (compact / normal / expanded).
 */
export function MetricChart({ option, className, height = 120 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const chart = echarts.init(el, undefined, { renderer: "canvas" });
    chartRef.current = chart;
    chart.setOption(option, { notMerge: false, lazyUpdate: true });

    const observer = new ResizeObserver(() => {
      chart.resize();
    });
    observer.observe(el);

    return () => {
      observer.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.setOption(option, { notMerge: false, lazyUpdate: true });
  }, [option]);

  return (
    <div
      ref={ref}
      data-metric-chart="true"
      className={cn("w-full", className)}
      style={{ height }}
    />
  );
}
