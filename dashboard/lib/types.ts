export type HostInfo = {
  hostname: string;
  os: string;
  arch: string;
  platform: string;
};

export type AgentInfo = {
  version: string;
  goVersion: string;
  startedAtUnixMs: number;
  samplesSent: number;
};

export type CpuMetrics = {
  usagePercent: number;
  logicalCores: number;
  load1: number;
  load5: number;
  load15: number;
  perCorePercent: number[];
};

export type MemoryMetrics = {
  totalMb: number;
  usedMb: number;
  availableMb: number;
  cachedMb: number;
  swapTotalMb: number;
  swapUsedMb: number;
};

export type DiskMetrics = {
  mount: string;
  device: string;
  usedGb: number;
  totalGb: number;
  readBytesPerSec: number;
  writeBytesPerSec: number;
  readOpsPerSec: number;
  writeOpsPerSec: number;
};

export type NetworkMetrics = {
  interfaceName: string;
  rxBytesPerSec: number;
  txBytesPerSec: number;
  rxPacketsPerSec: number;
  txPacketsPerSec: number;
  rxErrors: number;
  txErrors: number;
  rxDropped: number;
  txDropped: number;
  rxBytesTotal: number;
  txBytesTotal: number;
};

export type ProcessMetrics = {
  pid: number;
  ppid?: number;
  name: string;
  user?: string;
  state?: string;
  cpuPercent: number;
  memoryMb: number;
  threadCount?: number;
  rssBytes?: number;
  vmsBytes?: number;
  readBytesPerSec?: number;
  writeBytesPerSec?: number;
  startTimeUnixMs?: number;
  command?: string;
};

export type ProcessSummary = {
  total: number;
  running: number;
  sleeping: number;
  zombie: number;
  stopped: number;
  idle: number;
  other: number;
  threads: number;
};

export type HostExtras = {
  uptimeSeconds: number;
  load1: number;
  load5: number;
  load15: number;
  loadAvailable: boolean;
};

export type DockerContainer = {
  id: string;
  name: string;
  image?: string;
  state: string;
  cpuPercent: number;
  memoryMb: number;
};

export type DockerSummary = {
  available: boolean;
  serverVersion?: string;
  containersRunning: number;
  containersPaused: number;
  containersStopped: number;
  images: number;
  topContainers: DockerContainer[];
  errorMessage?: string;
};

export type GpuSensor = {
  name: string;
  utilizationPercent: number;
  memoryUsedMb: number;
  memoryTotalMb: number;
  temperatureC: number;
};

export type TempSensor = {
  name: string;
  celsius: number;
};

export type SensorSummary = {
  gpus: GpuSensor[];
  temperatures: TempSensor[];
};

export type MetricsEnvelope = {
  serverId: string;
  collectedAtUnixMs: number;
  sequence: number;
  host: HostInfo;
  cpu: CpuMetrics;
  memory: MemoryMetrics;
  disks: DiskMetrics[];
  networks: NetworkMetrics[];
  topProcesses: ProcessMetrics[];
  agent: AgentInfo;
  processSummary?: ProcessSummary | null;
  hostExtras?: HostExtras | null;
  docker?: DockerSummary | null;
  sensors?: SensorSummary | null;
};

/** @deprecated alias for buffer typing during migration */
export type MetricsPoint = MetricsEnvelope;

export type ConnectionStatus = "connected" | "reconnecting" | "disconnected";

export const BUFFER_SIZE = 150;
