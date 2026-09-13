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
curl -fsSL https://raw.githubusercontent.com/SokmeanKao/Pulsegrid/main/scripts/install-agent.sh \
  | sudo bash -s -- \
      --server-id kali-01 \
      --monitor MONITOR_IP:50051 \
      --token pg_join_xxxxx \
      --ca /path/to/ca.crt
```

## Windows (from repo)

```powershell
.\scripts\build-agent.ps1
.\scripts\run-agent.ps1 -ServerId local-01 `
  -Monitor localhost:50051 `
  -Token pg_join_xxxxx `
  -CaFile .\certs\ca.crt
```

## Container

```bash
docker run --rm \
  -e SERVER_ID=kali-01 \
  -e MONITOR_ADDRESS=192.168.150.10:50051 \
  -e JOIN_TOKEN=pg_join_xxxxx \
  -e MONITOR_CA_FILE=/certs/ca.crt \
  -v /path/to/ca.crt:/certs/ca.crt:ro \
  ghcr.io/sokmeankao/pulsegrid-agent:latest
```

Prefer the host binary/systemd install for real host metrics.
