"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { iconMd, iconStroke } from "@/lib/dashboard/icons";
import { buildEnrollmentMaterials, type EnrollmentCommands } from "@/lib/enrollmentCommands";
import { loadPulsegridConfig } from "@/lib/runtimeConfig";
import { EnrollmentMaterials } from "@/components/agents/EnrollmentMaterials";

type Props = {
  open: boolean;
  onClose: () => void;
};

type EnrollResponse = {
  serverId: string;
  token: string;
  expiresAt: string;
  monitorAddress: string;
  caUrl?: string;
  enrollUrl?: string;
  installCommand: string;
  commands?: EnrollmentCommands;
};

type ResultState = {
  serverId: string;
  token: string;
  expiresAt: string;
  monitorAddress: string;
  caUrl: string;
  enrollUrl: string;
  commands: EnrollmentCommands;
  installCommand: string;
};

export function AddAgentModal({ open, onClose }: Props) {
  const [serverId, setServerId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResultState | null>(null);

  if (!open) return null;

  async function enroll() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const cfg = await loadPulsegridConfig();
      const res = await fetch(`${cfg.apiUrl}/api/agents/enroll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverId: serverId.trim() }),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as EnrollResponse;
      if (data.commands && data.caUrl && data.enrollUrl) {
        setResult({
          serverId: data.serverId,
          token: data.token,
          expiresAt: data.expiresAt,
          monitorAddress: data.monitorAddress,
          caUrl: data.caUrl,
          enrollUrl: data.enrollUrl,
          commands: data.commands,
          installCommand: data.installCommand || data.commands.linux,
        });
      } else {
        const built = buildEnrollmentMaterials({
          serverId: data.serverId,
          token: data.token,
          advertiseHost: cfg.advertiseHost,
          gatewayPort: cfg.gatewayPort,
          httpPort: cfg.httpPort,
          agentVersion: cfg.agentVersion,
        });
        setResult({
          ...built,
          expiresAt: data.expiresAt,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enroll failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto border border-[var(--t-border)] bg-[var(--t-panel)] p-4 font-mono text-xs text-[var(--t-text)]">
        <div className="mb-3 flex items-center justify-between text-[var(--t-info)]">
          <span className="inline-flex items-center gap-1.5 uppercase tracking-wider">
            <Plus className={iconMd} strokeWidth={iconStroke} aria-hidden />
            Add Agent
          </span>
          <button type="button" onClick={onClose} className="text-[var(--t-muted)] hover:text-[var(--t-text)]">
            <X className={iconMd} strokeWidth={iconStroke} aria-hidden />
          </button>
        </div>

        {!result ? (
          <div className="space-y-3">
            <label className="block space-y-1">
              <span className="text-[var(--t-muted)]">Agent name / server id</span>
              <input
                value={serverId}
                onChange={(e) => setServerId(e.target.value)}
                placeholder="kali-01"
                className="w-full border border-[var(--t-border)] bg-[var(--t-bg)] px-2 py-1 outline-none"
              />
            </label>
            {error ? <p className="text-[var(--t-critical)]">{error}</p> : null}
            <button
              type="button"
              disabled={busy || !serverId.trim()}
              onClick={() => void enroll()}
              className="border border-[var(--t-info)] px-3 py-1 text-[var(--t-info)] disabled:opacity-40"
            >
              {busy ? "Creating…" : "Generate install materials"}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <EnrollmentMaterials {...result} />
            <button
              type="button"
              className="border border-[var(--t-border)] px-2 py-1"
              onClick={() => {
                setResult(null);
                setServerId("");
              }}
            >
              Enroll another
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
