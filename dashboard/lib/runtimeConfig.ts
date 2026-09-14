import { useEffect, useState } from "react";

export type PulsegridRuntimeConfig = {
  apiUrl: string;
  wsUrl: string;
  backendPort: string;
};

function deriveFromWindow(backendPort: string): PulsegridRuntimeConfig {
  if (typeof window === "undefined") {
    return {
      apiUrl: "http://localhost:8080",
      wsUrl: "ws://localhost:8080/ws/metrics",
      backendPort,
    };
  }
  const host = window.location.hostname || "localhost";
  const wsProto = window.location.protocol === "https:" ? "wss" : "ws";
  return {
    apiUrl: `http://${host}:${backendPort}`,
    wsUrl: `${wsProto}://${host}:${backendPort}/ws/metrics`,
    backendPort,
  };
}

/** Resolve API/WS URLs: runtime env → NEXT_PUBLIC → browser host. */
export async function loadPulsegridConfig(): Promise<PulsegridRuntimeConfig> {
  let backendPort = "8080";
  let apiUrl = "";
  let wsUrl = "";

  try {
    const res = await fetch("/api/pulsegrid-config", { cache: "no-store" });
    if (res.ok) {
      const j = (await res.json()) as {
        apiUrl?: string;
        wsUrl?: string;
        backendPort?: string;
      };
      apiUrl = (j.apiUrl ?? "").trim();
      wsUrl = (j.wsUrl ?? "").trim();
      if (j.backendPort) backendPort = String(j.backendPort).trim() || "8080";
    }
  } catch {
    /* ignore — fall through to env / derive */
  }

  if (!apiUrl) {
    apiUrl = process.env.NEXT_PUBLIC_API_URL?.trim() || "";
  }
  if (!wsUrl) {
    wsUrl = process.env.NEXT_PUBLIC_WS_URL?.trim() || "";
  }

  const derived = deriveFromWindow(backendPort);
  return {
    apiUrl: apiUrl || derived.apiUrl,
    wsUrl: wsUrl || derived.wsUrl,
    backendPort,
  };
}

export function usePulsegridConfig(): {
  config: PulsegridRuntimeConfig | null;
  ready: boolean;
} {
  const [config, setConfig] = useState<PulsegridRuntimeConfig | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadPulsegridConfig().then((c) => {
      if (!cancelled) setConfig(c);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return { config, ready: config !== null };
}
