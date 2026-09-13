"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  Server,
} from "lucide-react";
import { MetricsProvider, useMetricsSocket } from "@/lib/useMetricsSocket";
import { ServerCard } from "@/components/ServerCard";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

function statusBadge(status: string) {
  if (status === "connected") return <Badge variant="success">Connected</Badge>;
  if (status === "reconnecting")
    return <Badge variant="warning">Reconnecting</Badge>;
  return <Badge variant="destructive">Disconnected</Badge>;
}

function DashboardBody() {
  const { status, serverIds } = useMetricsSocket();
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem("pulsegrid.view", "gui");
  }, []);

  useEffect(() => {
    if (!selected && serverIds.length > 0) {
      setSelected(serverIds[0]);
    }
    if (selected && !serverIds.includes(selected)) {
      setSelected(serverIds[0] ?? null);
    }
  }, [serverIds, selected]);

  return (
    <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-4 p-4 md:p-6 lg:p-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
            Pulsegrid
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">
            Fleet metrics
          </h1>
        </div>
        <div className="flex items-center gap-2" role="status">
          <button
            type="button"
            className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
            onClick={() => {
              localStorage.removeItem("pulsegrid.grid.gui.server");
              window.location.reload();
            }}
            title="Reset GridStack layout"
          >
            Reset layout
          </button>
          <Link
            href="/terminal"
            className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
            onClick={() => localStorage.setItem("pulsegrid.view", "terminal")}
          >
            GUI | TUI
          </Link>
          {statusBadge(status)}
        </div>
      </header>

      {status !== "connected" && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="flex items-start gap-3 p-4 text-amber-900">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="text-sm">
              Live feed is <strong>{status}</strong>. Charts pause until the
              WebSocket reconnects — last samples may be outdated.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <Card className="h-[min(70vh,720px)] overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Server className="h-4 w-4 text-slate-600" />
              Servers
            </CardTitle>
            <CardDescription>
              {serverIds.length} agent{serverIds.length === 1 ? "" : "s"}{" "}
              reporting
            </CardDescription>
          </CardHeader>
          <Separator />
          <CardContent className="p-0">
            <ScrollArea className="h-[calc(min(70vh,720px)-7.5rem)]">
              <div className="space-y-1 p-3">
                {serverIds.length === 0 ? (
                  <p className="px-2 py-6 text-sm text-slate-500">
                    Waiting for the first metrics frame…
                  </p>
                ) : (
                  serverIds.map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setSelected(id)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                        selected === id
                          ? "bg-slate-900 text-white"
                          : "text-slate-700 hover:bg-slate-100",
                      )}
                    >
                      <Activity
                        className={cn(
                          "h-4 w-4",
                          selected === id ? "text-emerald-300" : "text-emerald-600",
                        )}
                      />
                      <span className="font-medium">{id}</span>
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <div>
          {selected ? (
            <ServerCard serverId={selected} />
          ) : (
            <Card>
              <CardContent className="p-8 text-sm text-slate-500">
                Select a server from the list to inspect live metrics.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <MetricsProvider>
      <DashboardBody />
    </MetricsProvider>
  );
}
