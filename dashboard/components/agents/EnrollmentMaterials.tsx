"use client";

import { useState } from "react";
import { Copy, Download, Eye, EyeOff } from "lucide-react";
import { iconMd, iconStroke } from "@/lib/dashboard/icons";
import type { EnrollmentCommands } from "@/lib/enrollmentCommands";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type EnrollmentMaterialsProps = {
  serverId: string;
  token: string;
  expiresAt?: string;
  monitorAddress: string;
  caUrl: string;
  enrollUrl?: string;
  commands: EnrollmentCommands;
  installCommand: string;
};

const TABS: { id: keyof EnrollmentCommands; label: string; steps: string[] }[] = [
  {
    id: "linux",
    label: "Linux",
    steps: [
      "Download CA (or let the one-liner fetch it)",
      "Run the install command as root on the agent host",
      "Check: sudo systemctl status pulsegrid-agent",
    ],
  },
  {
    id: "windowsGitBash",
    label: "Windows · Git Bash",
    steps: [
      "Open Git Bash (MINGW64) — not PowerShell",
      "Paste the block (downloads CA + agent exe)",
      "Leave the window open while the agent runs",
    ],
  },
  {
    id: "windowsPowerShell",
    label: "Windows · PowerShell",
    steps: [
      "Open Windows PowerShell — not Git Bash",
      "Paste the block (downloads CA + agent exe)",
      "Leave the window open while the agent runs",
    ],
  },
  {
    id: "docker",
    label: "Docker",
    steps: [
      "Download ca.crt into the directory you run docker from",
      "Run the container command",
      "Confirm the host shows ONLINE in the dashboard",
    ],
  },
];

export function EnrollmentMaterials(props: EnrollmentMaterialsProps) {
  const [reveal, setReveal] = useState(false);
  const masked =
    props.token.length <= 12
      ? "••••••••"
      : `${props.token.slice(0, 8)}…${props.token.slice(-4)}`;

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="space-y-3 font-mono text-xs text-[var(--t-text)]">
      <div className="space-y-1 border border-[var(--t-border)] bg-[var(--t-bg)] p-2">
        <p>
          <span className="text-[var(--t-muted)]">Server id:</span> {props.serverId}
        </p>
        <p>
          <span className="text-[var(--t-muted)]">Gateway:</span> {props.monitorAddress}
        </p>
        <p className="flex flex-wrap items-center gap-2">
          <span className="text-[var(--t-muted)]">Token:</span>
          <span className="break-all">{reveal ? props.token : masked}</span>
          <button
            type="button"
            className="text-[var(--t-muted)] hover:text-[var(--t-info)]"
            onClick={() => setReveal((v) => !v)}
            aria-label={reveal ? "Hide token" : "Reveal token"}
          >
            {reveal ? (
              <EyeOff className={iconMd} strokeWidth={iconStroke} />
            ) : (
              <Eye className={iconMd} strokeWidth={iconStroke} />
            )}
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-[var(--t-muted)] hover:text-[var(--t-info)]"
            onClick={() => void copy(props.token)}
          >
            <Copy className={iconMd} strokeWidth={iconStroke} />
            Copy
          </button>
        </p>
        {props.expiresAt ? (
          <p className="text-[10px] text-[var(--t-muted)]">Expires: {props.expiresAt}</p>
        ) : null}
        <p className="text-[10px] text-[var(--t-warning)]">
          Treat the join token like a password — valid ~24h, single-use enroll.
        </p>
      </div>

      <a
        className="inline-flex items-center gap-1 border border-[var(--t-border)] px-2 py-1 hover:text-[var(--t-info)]"
        href={props.caUrl}
        target="_blank"
        rel="noreferrer"
      >
        <Download className={iconMd} strokeWidth={iconStroke} />
        Download ca.crt
      </a>

      <div className="space-y-1">
        <p className="text-[10px] uppercase tracking-wider text-[var(--t-info)]">Platform</p>
        <Tabs defaultValue="linux">
          <TabsList>
            {TABS.map((t) => (
              <TabsTrigger key={t.id} value={t.id}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {TABS.map((t) => (
            <TabsContent key={t.id} value={t.id} className="space-y-2">
              <ol className="list-decimal space-y-0.5 pl-4 text-[10px] text-[var(--t-muted)]">
                {t.steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
              <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all border border-[var(--t-border)] bg-[var(--t-bg)] p-2">
                {props.commands[t.id]}
              </pre>
              <button
                type="button"
                className="inline-flex items-center gap-1 border border-[var(--t-border)] px-2 py-1 hover:text-[var(--t-info)]"
                onClick={() => void copy(props.commands[t.id])}
              >
                <Copy className={iconMd} strokeWidth={iconStroke} />
                Copy command
              </button>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}
