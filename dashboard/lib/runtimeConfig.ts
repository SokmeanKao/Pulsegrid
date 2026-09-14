import { useEffect, useState } from "react";

export type PulsegridRuntimeConfig = {
  apiUrl: string;
  wsUrl: string;
  backendPort: string;
  advertiseHost: string;
  gatewayPort: number;
  httpPort: number;
  agentVersion: string;
};

function defaultsFromWindow(): Pick<
  PulsegridRuntimeConfig,
  "advertiseHost" | "gatewayPort" | "httpPort" | "agentVersion"
> {
  if (typeof window === "undefined") {
    return {
      advertiseHost: "localhost",
      gatewayPort: 50051,
      httpPort: 8080,
      agentVersion: "v2.3.3",
    };
  }
  const port = window.location.port
    ? Number(window.location.port)
    : window.location.protocol === "https:"
      ? 443
      : 80;
  return {
    advertiseHost: window.location.hostname || "localhost",
    gatewayPort: 50051,
    httpPort: port === 80 || port === 443 ? port : port || 8080,
    agentVersion: "v2.3.3",
  };
}

function sameOriginFromWindow(): PulsegridRuntimeConfig {
  const d = defaultsFromWindow();
  if (typeof window === "undefined") {
    return {
      apiUrl: "http://localhost",
      wsUrl: "ws://localhost/ws/metrics",
      backendPort: "80",
      ...d,
    };
  }
  const wsProto = window.location.protocol === "https:" ? "wss" : "ws";
  return {
    apiUrl: window.location.origin,
    wsUrl: `${wsProto}://${window.location.host}/ws/metrics`,
    backendPort: window.location.port || (window.location.protocol === "https:" ? "443" : "80"),
    ...d,
  };
}

function splitPortsFromWindow(backendPort: string): PulsegridRuntimeConfig {
  const d = defaultsFromWindow();
  if (typeof window === "undefined") {
    return {
      apiUrl: `http://localhost:${backendPort}`,
      wsUrl: `ws://localhost:${backendPort}/ws/metrics`,
      backendPort,
      ...d,
      httpPort: Number(backendPort) || d.httpPort,
    };
  }
  const host = window.location.hostname || "localhost";
  const wsProto = window.location.protocol === "https:" ? "wss" : "ws";
  return {
    apiUrl: `http://${host}:${backendPort}`,
    wsUrl: `${wsProto}://${host}:${backendPort}/ws/metrics`,
    backendPort,
    ...d,
    advertiseHost: host,
    httpPort: Number(backendPort) || d.httpPort,
  };
}

/** Resolve API/WS URLs: runtime env → NEXT_PUBLIC → same-origin or host:port. */
export async function loadPulsegridConfig(): Promise<PulsegridRuntimeConfig> {
  let sameOrigin = true;
  let backendPort = "";
  let apiUrl = "";
  let wsUrl = "";
  let advertiseHost = "";
  let gatewayPort = 0;
  let httpPort = 0;
  let agentVersion = "";

  try {
    const res = await fetch("/pulsegrid-config", { cache: "no-store" });
    if (res.ok) {
      const j = (await res.json()) as {
        sameOrigin?: boolean;
        apiUrl?: string;
        wsUrl?: string;
        backendPort?: string;
        advertiseHost?: string;
        gatewayPort?: number | string;
        httpPort?: number | string;
        agentVersion?: string;
      };
      if (typeof j.sameOrigin === "boolean") sameOrigin = j.sameOrigin;
      apiUrl = (j.apiUrl ?? "").trim();
      wsUrl = (j.wsUrl ?? "").trim();
      backendPort = (j.backendPort ?? "").trim();
      advertiseHost = (j.advertiseHost ?? "").trim();
      gatewayPort = Number(j.gatewayPort) || 0;
      httpPort = Number(j.httpPort) || 0;
      agentVersion = (j.agentVersion ?? "").trim();
    }
  } catch {
    /* ignore */
  }

  if (!apiUrl) apiUrl = process.env.NEXT_PUBLIC_API_URL?.trim() || "";
  if (!wsUrl) wsUrl = process.env.NEXT_PUBLIC_WS_URL?.trim() || "";

  // Next.js dev / split compose: UI on :3000, API on :8080 — never treat UI origin as API.
  if (
    !apiUrl &&
    typeof window !== "undefined" &&
    (window.location.port === "3000" || window.location.port === "3001")
  ) {
    const host = window.location.hostname || "localhost";
    apiUrl = `http://${host}:8080`;
    if (!wsUrl) {
      const wsProto = window.location.protocol === "https:" ? "wss" : "ws";
      wsUrl = `${wsProto}://${host}:8080/ws/metrics`;
    }
    sameOrigin = false;
    backendPort = backendPort || "8080";
  }

  const derived =
    sameOrigin || !backendPort
      ? sameOriginFromWindow()
      : splitPortsFromWindow(backendPort);

  const base =
    apiUrl && wsUrl
      ? {
          apiUrl,
          wsUrl,
          backendPort: backendPort || "8080",
          ...defaultsFromWindow(),
        }
      : derived;

  return {
    apiUrl: apiUrl || derived.apiUrl,
    wsUrl: wsUrl || derived.wsUrl,
    backendPort: backendPort || derived.backendPort,
    advertiseHost: advertiseHost || base.advertiseHost,
    gatewayPort: gatewayPort || base.gatewayPort,
    httpPort: httpPort || base.httpPort,
    agentVersion: agentVersion || base.agentVersion,
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
