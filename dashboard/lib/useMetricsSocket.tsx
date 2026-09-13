"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from "react";
import {
  BUFFER_SIZE,
  type ConnectionStatus,
  type MetricsPoint,
} from "./types";

type Buffers = Map<string, MetricsPoint[]>;

type MetricsContextValue = {
  status: ConnectionStatus;
  serverIds: string[];
  getBuffer: (serverId: string) => MetricsPoint[];
  buffersRef: MutableRefObject<Buffers>;
};

const MetricsContext = createContext<MetricsContextValue | null>(null);

function wsUrl(): string {
  return (
    process.env.NEXT_PUBLIC_WS_URL?.trim() ||
    "ws://localhost:8080/ws/metrics"
  );
}

export function MetricsProvider({ children }: { children: ReactNode }) {
  const buffersRef = useRef<Buffers>(new Map());
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [serverIds, setServerIds] = useState<string[]>([]);

  const getBuffer = useCallback((serverId: string) => {
    return buffersRef.current.get(serverId) ?? [];
  }, []);

  useEffect(() => {
    let disposed = false;
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;

    const bumpServers = (serverId: string) => {
      setServerIds((prev) =>
        prev.includes(serverId) ? prev : [...prev, serverId].sort(),
      );
    };

    const connect = () => {
      if (disposed) return;
      setStatus(attempt === 0 ? "disconnected" : "reconnecting");
      socket = new WebSocket(wsUrl());

      socket.onopen = () => {
        if (disposed) return;
        attempt = 0;
        setStatus("connected");
        socket?.send(JSON.stringify({ type: "subscribe", mode: "all" }));
      };

      socket.onmessage = (event) => {
        if (disposed) return;
        try {
          const point = JSON.parse(String(event.data)) as MetricsPoint;
          if (!point?.serverId) return;
          const existing = buffersRef.current.get(point.serverId) ?? [];
          const next = [...existing, point];
          if (next.length > BUFFER_SIZE) {
            next.splice(0, next.length - BUFFER_SIZE);
          }
          buffersRef.current.set(point.serverId, next);
          bumpServers(point.serverId);
        } catch {
          // ignore malformed frames
        }
      };

      socket.onerror = () => {
        // onclose handles reconnect
      };

      socket.onclose = () => {
        if (disposed) return;
        setStatus("reconnecting");
        attempt += 1;
        const delay = Math.min(30000, 1000 * 2 ** Math.min(attempt, 5));
        reconnectTimer = setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (socket) {
        socket.onclose = null;
        socket.close();
      }
    };
  }, []);

  const value = useMemo(
    () => ({ status, serverIds, getBuffer, buffersRef }),
    [status, serverIds, getBuffer],
  );

  return (
    <MetricsContext.Provider value={value}>{children}</MetricsContext.Provider>
  );
}

export function useMetricsSocket(): MetricsContextValue {
  const ctx = useContext(MetricsContext);
  if (!ctx) {
    throw new Error("useMetricsSocket must be used within MetricsProvider");
  }
  return ctx;
}
