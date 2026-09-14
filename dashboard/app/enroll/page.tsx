"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { EnrollmentMaterials } from "@/components/agents/EnrollmentMaterials";
import {
  buildEnrollmentMaterials,
  type EnrollmentMaterialsData,
} from "@/lib/enrollmentCommands";
import { loadPulsegridConfig } from "@/lib/runtimeConfig";

function EnrollInner() {
  const params = useSearchParams();
  const serverId = (params.get("s") ?? "").trim();
  const token = (params.get("t") ?? "").trim();
  const [ready, setReady] = useState(false);
  const [materials, setMaterials] = useState<EnrollmentMaterialsData | null>(null);

  useEffect(() => {
    if (!serverId || !token) {
      setReady(true);
      return;
    }
    let cancelled = false;
    void loadPulsegridConfig().then((cfg) => {
      if (cancelled) return;
      setMaterials(
        buildEnrollmentMaterials({
          serverId,
          token,
          advertiseHost: cfg.advertiseHost,
          gatewayPort: cfg.gatewayPort,
          httpPort: cfg.httpPort,
          agentVersion: cfg.agentVersion,
        }),
      );
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [serverId, token]);

  if (!ready) {
    return <p className="p-4 font-mono text-xs text-[var(--t-muted)]">Loading…</p>;
  }
  if (!serverId || !token || !materials) {
    return (
      <div className="min-h-screen bg-[var(--t-bg)] p-4 font-mono text-xs text-[var(--t-text)]">
        <p className="text-[var(--t-critical)]">Missing enroll parameters (s, t).</p>
        <Link href="/terminal" className="text-[var(--t-info)] underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--t-bg)] text-[var(--t-text)]">
      <div className="mx-auto max-w-2xl space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <h1 className="font-mono text-sm text-[var(--t-info)]">Pulsegrid — Enroll agent</h1>
          <Link href="/terminal" className="font-mono text-[10px] text-[var(--t-muted)] hover:text-[var(--t-info)]">
            Dashboard
          </Link>
        </div>
        <EnrollmentMaterials {...materials} />
      </div>
    </div>
  );
}

export default function EnrollPage() {
  return (
    <Suspense fallback={<p className="p-4 font-mono text-xs text-[var(--t-muted)]">Loading…</p>}>
      <EnrollInner />
    </Suspense>
  );
}
