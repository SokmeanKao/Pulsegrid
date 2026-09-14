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

## Install (Linux)

Run on the **Linux** agent host only. `install-agent.sh` needs `sudo` / systemd — it will not work in Windows Git Bash.

```bash
# On Monitor: docker compose cp monitor:/certs/ca.crt ./ca.crt
# Copy ca.crt to this Linux host, then:
sudo mkdir -p /etc/pulsegrid
sudo cp /path/to/ca.crt /etc/pulsegrid/ca.crt

curl -fsSL https://raw.githubusercontent.com/SokmeanKao/Pulsegrid/main/scripts/install-agent.sh \
  | sudo bash -s -- \
      --server-id kali-01 \
      --monitor MONITOR_IP:50051 \
      --token pg_join_xxxxx \
      --ca /etc/pulsegrid/ca.crt \
      --version v2.3.3
```

## Windows (release binary)

Do **not** use `install-agent.sh` or `sudo` on Windows.

### Git Bash (MINGW64)

```bash
mkdir -p /c/pulsegrid
cp /path/to/monitor/ca.crt /c/pulsegrid/ca.crt

curl -fL "https://github.com/SokmeanKao/Pulsegrid/releases/download/v2.3.3/pulsegrid-agent-windows-amd64.exe" \
  -o /c/pulsegrid/pulsegrid-agent.exe

export SERVER_ID=window-01
export MONITOR_ADDRESS=MONITOR_IP:50051
export JOIN_TOKEN='pg_join_xxxxx'
export MONITOR_CA_FILE=/c/pulsegrid/ca.crt

/c/pulsegrid/pulsegrid-agent.exe
```

### PowerShell (not Git Bash)

```powershell
New-Item -ItemType Directory -Force -Path C:\pulsegrid | Out-Null
Copy-Item C:\path\to\ca.crt C:\pulsegrid\ca.crt -Force

Invoke-WebRequest `
  -Uri "https://github.com/SokmeanKao/Pulsegrid/releases/download/v2.3.3/pulsegrid-agent-windows-amd64.exe" `
  -OutFile C:\pulsegrid\pulsegrid-agent.exe

$env:SERVER_ID = "window-01"
$env:MONITOR_ADDRESS = "MONITOR_IP:50051"
$env:JOIN_TOKEN = "pg_join_xxxxx"
$env:MONITOR_CA_FILE = "C:\pulsegrid\ca.crt"
C:\pulsegrid\pulsegrid-agent.exe
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
