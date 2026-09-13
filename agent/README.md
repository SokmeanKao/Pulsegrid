# Pulsegrid Agent

Go metrics agent that streams host stats over gRPC to the Pulsegrid backend.

**Binary name:** `pulsegrid-agent` (Windows: `pulsegrid-agent.exe`)

## Env

| Var | Required | Default | Meaning |
|---|---|---|---|
| `SERVER_ID` | yes | — | Host id shown in the dashboard (e.g. `local-01`, `kali-01`) |
| `PORT` | no | `50051` | gRPC listen port |

## Build

From repo root (Windows PowerShell):

```powershell
.\scripts\build-agent.ps1
```

Produces:

- `agent/dist/pulsegrid-agent.exe` — Windows amd64
- `agent/dist/pulsegrid-agent-linux-amd64` — Linux amd64 (Kali / Ubuntu / Debian)

## Run locally (Windows)

```powershell
cd C:\Dev\Pulsegrid\agent
$env:SERVER_ID = "local-01"
.\dist\pulsegrid-agent.exe
```

## Run on Linux (Kali)

On the Kali host (after copying the Linux binary):

```bash
chmod +x ./pulsegrid-agent-linux-amd64
export SERVER_ID=kali-01
export PORT=50051
./pulsegrid-agent-linux-amd64
```

Open the firewall if the backend is on another machine:

```bash
# ufw example
sudo ufw allow 50051/tcp
```

Backend on Windows should include the Kali host, e.g.:

```text
AGENTS=local-01:localhost:50051,kali-01:192.168.150.131:50051
```

## Deploy helper (from Windows)

```powershell
.\scripts\deploy-agent-linux.ps1 -HostAddress 192.168.150.131 -User kali -ServerId kali-01
```

You will be prompted for the SSH password. Do **not** put passwords in the repo.
