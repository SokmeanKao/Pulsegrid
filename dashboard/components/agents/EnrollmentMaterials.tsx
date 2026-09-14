"use client";

import { useState } from "react";
import { Copy, Download, Eye, EyeOff } from "lucide-react";
import { iconMd, iconStroke } from "@/lib/dashboard/icons";
import type { EnrollmentCommands } from "@/lib/enrollmentCommands";
import { cn } from "@/lib/utils";
import { QrCode } from "@/components/ui/qr-code";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type EnrollmentMaterialsProps = {
  serverId: string;
  token: string;
  expiresAt?: string;
  monitorAddress: string;
  caUrl: string;
  enrollUrl: string;
  commands: EnrollmentCommands;
  installCommand: string;
};

const TABS: { id: keyof EnrollmentCommands; label: string; steps: string[] }[] = [
  {
    id: "linux",
    label: "Linux",
    steps: [
      "Download CA (or the one-liner does it)",
      "Run the install command as root",
      "Confirm systemctl status pulsegrid-agent",
    ],
  },
  {
    id: "windowsGitBash",
    label: "Git Bash",
    steps: [
      "Download CA into C:\\pulsegrid (command does this)",
      "Paste the block into Git Bash (MINGW64)",
      "Leave the window open while the agent runs",
    ],
  },
  {
    id: "windowsPowerShell",
    label: "PowerShell",
    steps: [
      "Open Windows PowerShell (not Git Bash)",
      "Paste the block to download CA + agent and start",
      "Leave the window open while the agent runs",
    ],
  },
  {
    id: "docker",
    label: "Docker",
    steps: [
      "Download ca.crt next to where you run docker",
      "Run the container command",
      "Check the dashboard for ONLINE",
    ],
  },
];

export function EnrollmentMaterials(props: EnrollmentMaterialsProps) {
  const [reveal, setReveal] = useState(false);
  const [encodeLinux, setEncodeLinux] = useState(false);
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

  const qrValue = encodeLinux ? props.commands.linux : props.enrollUrl;

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
          Treat the token and QR like a password — valid ~24h, single-use enroll.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <a
          className="inline-flex items-center gap-1 border border-[var(--t-border)] px-2 py-1 hover:text-[var(--t-info)]"
          href={props.caUrl}
          target="_blank"
          rel="noreferrer"
        >
          <Download className={iconMd} strokeWidth={iconStroke} />
          Download ca.crt
        </a>
        <button
          type="button"
          className="inline-flex items-center gap-1 border border-[var(--t-border)] px-2 py-1 hover:text-[var(--t-info)]"
          onClick={() => void copy(props.enrollUrl)}
        >
          <Copy className={iconMd} strokeWidth={iconStroke} />
          Copy enroll URL
        </button>
      </div>

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
            <pre className="max-h-36 overflow-auto whitespace-pre-wrap break-all border border-[var(--t-border)] bg-[var(--t-bg)] p-2">
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

      <div className="space-y-2 border border-[var(--t-border)] bg-[var(--t-bg)] p-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] uppercase tracking-wider text-[var(--t-info)]">QR</span>
          <label className="flex items-center gap-2 text-[10px] text-[var(--t-muted)]">
            <Switch checked={encodeLinux} onCheckedChange={setEncodeLinux} />
            Encode Linux install command instead
          </label>
        </div>
        <div className="flex flex-wrap items-start gap-3">
          <QrCode
            value={qrValue}
            size={148}
            label={encodeLinux ? "Linux install QR" : "Enroll page QR"}
          />
          <p className={cn("max-w-xs text-[10px] text-[var(--t-muted)]")}>
            {encodeLinux
              ? "Scan to capture the Linux one-liner, then paste on the agent host."
              : "Scan to open the enroll page (same tabs + CA) on another device."}
          </p>
        </div>
      </div>
    </div>
  );
}
