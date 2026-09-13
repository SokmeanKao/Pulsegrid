"use client";

import { Skeleton } from "@/components/ui/skeleton";
import type { WidgetType } from "@/lib/dashboard/types";

export function CpuWidgetSkeleton() {
  return (
    <div className="flex h-full min-h-[140px] flex-col gap-3">
      <Skeleton className="h-5 w-28" />
      <div className="space-y-1.5">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-[92%]" />
        <Skeleton className="h-3 w-[85%]" />
        <Skeleton className="h-3 w-[70%]" />
      </div>
      <Skeleton className="mt-auto h-24 w-full" />
      <p className="text-[10px] text-[var(--t-muted)]">Loading CPU metrics…</p>
    </div>
  );
}

export function MemoryWidgetSkeleton() {
  return (
    <div className="flex h-full min-h-[120px] flex-col gap-3">
      <Skeleton className="h-4 w-16" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-4 w-16" />
      <Skeleton className="h-3 w-3/4" />
      <div className="mt-2 space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-28" />
      </div>
      <p className="mt-auto text-[10px] text-[var(--t-muted)]">
        Loading memory metrics…
      </p>
    </div>
  );
}

export function DiskWidgetSkeleton() {
  return (
    <div className="flex h-full min-h-[120px] flex-col gap-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-1">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-full" />
        </div>
      ))}
      <div className="mt-auto grid grid-cols-2 gap-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-full" />
      </div>
    </div>
  );
}

export function NetworkWidgetSkeleton() {
  return (
    <div className="flex h-full min-h-[120px] flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-6 w-24" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-6 w-24" />
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-[90%]" />
        <Skeleton className="h-3 w-[80%]" />
      </div>
      <p className="mt-auto text-[10px] text-[var(--t-muted)]">
        Loading network metrics…
      </p>
    </div>
  );
}

export function ProcessTableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex h-full min-h-[140px] flex-col gap-2">
      <div className="flex gap-2">
        <Skeleton className="h-3 w-10" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-10" />
        <Skeleton className="h-3 w-10" />
        <Skeleton className="h-3 w-14" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-2">
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-3 w-14" />
        </div>
      ))}
      <p className="mt-auto text-[10px] text-[var(--t-muted)]">
        Loading processes…
      </p>
    </div>
  );
}

export function ProcessHealthSkeleton() {
  return (
    <div className="flex h-full min-h-[100px] flex-col gap-3">
      <div className="grid grid-cols-5 gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
      <div className="space-y-1.5">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-[90%]" />
        <Skeleton className="h-3 w-[75%]" />
      </div>
    </div>
  );
}

export function TopProcessSkeleton() {
  return (
    <div className="flex h-full min-h-[100px] flex-col gap-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 flex-1" />
          <Skeleton className="h-3 w-12" />
        </div>
      ))}
    </div>
  );
}

export function widgetSkeleton(type: WidgetType) {
  switch (type) {
    case "cpu":
      return <CpuWidgetSkeleton />;
    case "memory":
      return <MemoryWidgetSkeleton />;
    case "disk":
      return <DiskWidgetSkeleton />;
    case "network":
      return <NetworkWidgetSkeleton />;
    case "processes":
      return <ProcessTableSkeleton />;
    case "proc-health":
      return <ProcessHealthSkeleton />;
    case "top-cpu":
    case "top-mem":
      return <TopProcessSkeleton />;
    default:
      return <CpuWidgetSkeleton />;
  }
}
