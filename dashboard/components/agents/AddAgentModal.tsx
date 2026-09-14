"use client";

import { useState } from "react";
import { Copy, Plus, X } from "lucide-react";
import { iconMd, iconStroke } from "@/lib/dashboard/icons";
import { loadPulsegridConfig } from "@/lib/runtimeConfig";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function AddAgentModal({ open, onClose }: Props) {
  const [serverId, setServerId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    token: string;
    monitorAddress: string;
    installCommand: string;
    caUrl: string;
  } | null>(null);

  if (!open) return null;

  async function enroll() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const { apiUrl } = await loadPulsegridConfig();
      const res = await fetch(`${apiUrl}/api/agents/enroll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverId: serverId.trim() }),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as {
        token: string;
        monitorAddress: string;
        installCommand: string;
      };
      setResult({
        ...data,
        caUrl: `${apiUrl}/api/agents/ca.crt`,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enroll failed");
    } finally {
      setBusy(false);
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg border border-[var(--t-border)] bg-[var(--t-panel)] p-4 font-mono text-xs text-[var(--t-text)]">
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
              {busy ? "Creating…" : "Generate install command"}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-[var(--t-muted)]">
              Run on the agent host (copy CA from Monitor first if needed):
            </p>
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all border border-[var(--t-border)] bg-[var(--t-bg)] p-2">
              {result.installCommand}
            </pre>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-1 border border-[var(--t-border)] px-2 py-1 hover:text-[var(--t-info)]"
                onClick={() => void copy(result.installCommand)}
              >
                <Copy className={iconMd} strokeWidth={iconStroke} aria-hidden />
                Copy command
              </button>
              <a
                className="border border-[var(--t-border)] px-2 py-1 hover:text-[var(--t-info)]"
                href={result.caUrl}
                target="_blank"
                rel="noreferrer"
              >
                Download ca.crt
              </a>
            </div>
            <p className={cn("text-[10px] text-[var(--t-muted)]")}>
              Monitor gateway: {result.monitorAddress} · token expires in 24h
            </p>
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
