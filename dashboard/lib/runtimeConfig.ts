import { useEffect, useState } from "react";

export type PulsegridRuntimeConfig = {
  apiUrl: string;
  wsUrl: string;
  backendPort: string;
};

function sameOriginFromWindow(): PulsegridRuntimeConfig {
  if (typeof window === "undefined") {
    return {
      apiUrl: "http://localhost",
      wsUrl: "ws://localhost/ws/metrics",
      backendPort: "80",
    };
  }
  const wsProto = window.location.protocol === "https:" ? "wss" : "ws";
  return {
    apiUrl: window.location.origin,
    wsUrl: `${wsProto}://${window.location.host}/ws/metrics`,
    backendPort: window.location.port || (window.location.protocol === "https:" ? "443" : "80"),
  };
}

function splitPortsFromWindow(backendPort: string): PulsegridRuntimeConfig {
  if (typeof window === "undefined") {
    return {
      apiUrl: `http://localhost:${backendPort}`,
      wsUrl: `ws://localhost:${backendPort}/ws/metrics`,
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

/** Resolve API/WS URLs: runtime env → NEXT_PUBLIC → same-origin or host:port. */
export async function loadPulsegridConfig(): Promise<PulsegridRuntimeConfig> {
  let sameOrigin = true;
  let backendPort = "";
  let apiUrl = "";
  let wsUrl = "";

  try {
    const res = await fetch("/pulsegrid-config", { cache: "no-store" });
    if (res.ok) {
      const j = (await res.json()) as {
        sameOrigin?: boolean;
        apiUrl?: string;
        wsUrl?: string;
        backendPort?: string;
      };
      if (typeof j.sameOrigin === "boolean") sameOrigin = j.sameOrigin;
      apiUrl = (j.apiUrl ?? "").trim();
      wsUrl = (j.wsUrl ?? "").trim();
      backendPort = (j.backendPort ?? "").trim();
    }
  } catch {
    /* ignore */
  }

  if (!apiUrl) apiUrl = process.env.NEXT_PUBLIC_API_URL?.trim() || "";
  if (!wsUrl) wsUrl = process.env.NEXT_PUBLIC_WS_URL?.trim() || "";

  // Explicit URLs win; else same-origin (nginx); else split ports.
  if (apiUrl && wsUrl) {
    return { apiUrl, wsUrl, backendPort: backendPort || "8080" };
  }

  const derived =
    sameOrigin || !backendPort
      ? sameOriginFromWindow()
      : splitPortsFromWindow(backendPort);

  return {
    apiUrl: apiUrl || derived.apiUrl,
    wsUrl: wsUrl || derived.wsUrl,
    backendPort: backendPort || derived.backendPort,
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
