export type EnrollmentCommands = {
  linux: string;
  windowsGitBash: string;
  windowsPowerShell: string;
  docker: string;
};

export type EnrollmentMaterialsData = {
  serverId: string;
  token: string;
  monitorAddress: string;
  caUrl: string;
  enrollUrl: string;
  commands: EnrollmentCommands;
  installCommand: string;
};

function publicHttpBase(advertiseHost: string, httpPort: number): string {
  const host = advertiseHost.trim() || "localhost";
  const port = httpPort <= 0 ? 8080 : httpPort;
  if (port === 80) return `http://${host}`;
  return `http://${host}:${port}`;
}

export function buildEnrollmentMaterials(input: {
  serverId: string;
  token: string;
  advertiseHost: string;
  gatewayPort: number;
  httpPort: number;
  agentVersion: string;
}): EnrollmentMaterialsData {
  const serverId = input.serverId.trim();
  const token = input.token.trim();
  const ver = input.agentVersion.trim() || "v2.3.3";
  const monitorAddress = `${input.advertiseHost.trim() || "localhost"}:${input.gatewayPort || 50051}`;
  const httpBase = publicHttpBase(input.advertiseHost, input.httpPort);
  const caUrl = `${httpBase}/api/agents/ca.crt`;
  const enrollUrl = `${httpBase}/enroll?s=${encodeURIComponent(serverId)}&t=${encodeURIComponent(token)}`;

  const linux =
    `sudo mkdir -p /etc/pulsegrid && sudo curl -fsSL ${caUrl} -o /etc/pulsegrid/ca.crt && ` +
    `curl -fsSL https://raw.githubusercontent.com/SokmeanKao/Pulsegrid/main/scripts/install-agent.sh ` +
    `| sudo bash -s -- --server-id ${serverId} --monitor ${monitorAddress} --token ${token} --ca /etc/pulsegrid/ca.crt --version ${ver}`;

  const windowsGitBash =
    `mkdir -p /c/pulsegrid && curl -fsSL ${caUrl} -o /c/pulsegrid/ca.crt && ` +
    `curl -fL https://github.com/SokmeanKao/Pulsegrid/releases/download/${ver}/pulsegrid-agent-windows-amd64.exe ` +
    `-o /c/pulsegrid/pulsegrid-agent.exe && ` +
    `export SERVER_ID=${serverId} MONITOR_ADDRESS=${monitorAddress} JOIN_TOKEN='${token}' MONITOR_CA_FILE=/c/pulsegrid/ca.crt && ` +
    `/c/pulsegrid/pulsegrid-agent.exe`;

  const windowsPowerShell =
    `New-Item -ItemType Directory -Force -Path C:\\pulsegrid | Out-Null; ` +
    `Invoke-WebRequest -Uri ${caUrl} -OutFile C:\\pulsegrid\\ca.crt; ` +
    `Invoke-WebRequest -Uri https://github.com/SokmeanKao/Pulsegrid/releases/download/${ver}/pulsegrid-agent-windows-amd64.exe ` +
    `-OutFile C:\\pulsegrid\\pulsegrid-agent.exe; ` +
    `$env:SERVER_ID='${serverId}'; $env:MONITOR_ADDRESS='${monitorAddress}'; $env:JOIN_TOKEN='${token}'; ` +
    `$env:MONITOR_CA_FILE='C:\\pulsegrid\\ca.crt'; C:\\pulsegrid\\pulsegrid-agent.exe`;

  const docker =
    `docker run -d --name pulsegrid-agent-${serverId} ` +
    `-e SERVER_ID=${serverId} -e MONITOR_ADDRESS=${monitorAddress} -e JOIN_TOKEN=${token} ` +
    `-e MONITOR_CA_FILE=/certs/ca.crt ` +
    `-v \${PWD}/ca.crt:/certs/ca.crt:ro ` +
    `ghcr.io/sokmeankao/pulsegrid-agent:${ver}`;

  const commands: EnrollmentCommands = {
    linux,
    windowsGitBash,
    windowsPowerShell,
    docker,
  };

  return {
    serverId,
    token,
    monitorAddress,
    caUrl,
    enrollUrl,
    commands,
    installCommand: linux,
  };
}
