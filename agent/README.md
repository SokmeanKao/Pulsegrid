# Pulsegrid Agent

Go metrics agent that **dials** the Pulsegrid Monitor Agent Gateway over TLS and streams host stats.

**Binary name:** `pulsegrid-agent` (Windows: `pulsegrid-agent.exe`)

Full product install guide: **[docs/INSTALL.md](../docs/INSTALL.md)**.

## Env

| Var | Required | Meaning |
|---|---|---|
| `SERVER_ID` | yes | Host id shown in the dashboard |
| `MONITOR_ADDRESS` | yes | Monitor gateway `host:port` (e.g. `192.168.150.10:50051`) |
| `MONITOR_CA_FILE` | yes | Path to Monitor `ca.crt` |
| `JOIN_TOKEN` | first enroll | `pg_join_…` from UI Add Agent (optional after registered) |

The agent does **not** listen on a port.

## Install (Linux one-liner)

```bash
# Copy Monitor ca.crt to this host first (from Monitor: docker compose cp monitor:/certs/ca.crt ./ca.crt)
curl -fsSL https://raw.githubusercontent.com/SokmeanKao/Pulsegrid/main/scripts/install-agent.sh \
  | sudo bash -s -- \
      --server-id kali-01 \
      --monitor MONITOR_IP:50051 \
      --token pg_join_xxxxx \
      --ca /path/to/ca.crt \
      --version v2.3.3
```

## Windows (release binary)

1. Download `pulsegrid-agent-windows-amd64.exe` from [Releases](https://github.com/SokmeanKao/Pulsegrid/releases).
2. Copy Monitor `ca.crt` to the machine.
3. Run:

```powershell
$env:SERVER_ID = "win-01"
$env:MONITOR_ADDRESS = "MONITOR_IP:50051"
$env:JOIN_TOKEN = "pg_join_xxxxx"
$env:MONITOR_CA_FILE = "C:\path\to\ca.crt"
.\pulsegrid-agent-windows-amd64.exe
```

From a repo checkout:

```powershell
.\scripts\build-agent.ps1
.\scripts\run-agent.ps1 -ServerId local-01 `
  -Monitor localhost:50051 `
  -Token pg_join_xxxxx `
  -CaFile .\ca.crt
```

## Container

```bash
docker run --rm \
  -e SERVER_ID=kali-01 \
  -e MONITOR_ADDRESS=MONITOR_IP:50051 \
  -e JOIN_TOKEN=pg_join_xxxxx \
  -e MONITOR_CA_FILE=/certs/ca.crt \
  -v /path/to/ca.crt:/certs/ca.crt:ro \
  ghcr.io/sokmeankao/pulsegrid-agent:v2.3.3
```

## Optional: Docker access

If the Docker widget should show live containers, the agent needs access to the Docker CLI/engine (Linux: often add the agent user to the `docker` group; Windows: Docker Desktop running). Without Docker, the widget shows **unavailable** and other metrics continue normally.
