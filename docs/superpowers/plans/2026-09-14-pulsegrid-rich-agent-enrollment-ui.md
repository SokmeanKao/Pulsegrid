# Rich Agent Enrollment UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrich Monitor agent enrollment so operators pick an OS, copy the right install commands, download the CA, and scan a QR (default short enroll URL; optional Linux one-liner).

**Architecture:** Backend `POST /api/agents/enroll` returns `caUrl`, `enrollUrl`, and per-OS `commands` (keep `installCommand`). Dashboard gets a shared enrollment panel (tabs + QR), rewrites `AddAgentModal`, and adds a static `/enroll/` page that rebuilds the same UI from query params + runtime config. QR is a shadcn-style wrapper around `qrcode.react`.

**Tech Stack:** Spring Boot 4, Next.js 16 static export, React 19, Tailwind 4, existing dashboard CSS vars, `qrcode.react`, shadcn-style UI primitives (Tabs/Switch/Button as needed).

## Global Constraints

- Dashboard remains `output: "export"` — enroll page must be client-only under `app/enroll/page.tsx`
- Keep response field `installCommand` as alias of `commands.linux`
- Default public HTTP port for `caUrl`/`enrollUrl`: `8080` via `GATEWAY_HTTP_PORT` (or equivalent)
- Agent version pin via `PULSEGRID_AGENT_VERSION` (default `v2.3.3`)
- Terminal aesthetic: existing `--t-*` CSS variables; no purple/glow redesign
- QR default payload = `enrollUrl`; toggle switches to Linux one-liner
- Warn that tokens in URLs/QR are secrets (24h TTL)
- Spec: `docs/superpowers/specs/2026-09-14-pulsegrid-rich-agent-enrollment-ui-design.md`

## File map

| File | Responsibility |
|---|---|
| `backend/.../enrollment/AgentInstallCommands.java` | Build linux / windowsGitBash / windowsPowerShell / docker strings |
| `backend/.../enrollment/EnrollmentController.java` | Enriched JSON response |
| `backend/.../enrollment/EnrollmentControllerTest.java` (or service test) | Assert commands + urls |
| `backend/.../web/PulsegridConfigController.java` | Expose `advertiseHost`, `gatewayPort`, `httpPort`, `agentVersion` for enroll page |
| `dashboard/package.json` | Add `qrcode.react` (+ types if needed) |
| `dashboard/components/ui/qr-code.tsx` | shadcn-style QR wrapper |
| `dashboard/components/ui/tabs.tsx` | Tabs primitive if missing |
| `dashboard/components/ui/switch.tsx` | Switch primitive if missing |
| `dashboard/lib/enrollmentCommands.ts` | Client-side rebuild of commands + urls (parity with backend) |
| `dashboard/components/agents/EnrollmentMaterials.tsx` | Shared tabs + steps + CA + QR + token UI |
| `dashboard/components/agents/AddAgentModal.tsx` | Use EnrollmentMaterials after enroll |
| `dashboard/app/enroll/page.tsx` | Static enroll landing from `?s=&t=` |
| `docs/INSTALL.md` | One-line pointer to UI enrollment |

---

### Task 1: Backend install command builder + enriched enroll API

**Files:**
- Create: `backend/src/main/java/com/monitoring/backend/enrollment/AgentInstallCommands.java`
- Modify: `backend/src/main/java/com/monitoring/backend/enrollment/EnrollmentController.java`
- Test: `backend/src/test/java/com/monitoring/backend/enrollment/AgentInstallCommandsTest.java`

**Interfaces:**
- Produces: `AgentInstallCommands.build(serverId, monitorAddress, token, caUrl, agentVersion) → Map` with keys `linux`, `windowsGitBash`, `windowsPowerShell`, `docker`
- Produces: enroll JSON fields `caUrl`, `enrollUrl`, `commands`, `installCommand`

- [ ] **Step 1: Write failing unit test**

```java
package com.monitoring.backend.enrollment;

import org.junit.jupiter.api.Test;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;

class AgentInstallCommandsTest {
	@Test
	void buildsLinuxWindowsDockerCommands() {
		Map<String, String> c = AgentInstallCommands.build(
				"kali-01",
				"192.168.0.230:50051",
				"pg_join_test",
				"http://192.168.0.230:8080/api/agents/ca.crt",
				"v2.3.3");
		assertTrue(c.get("linux").contains("--server-id kali-01"));
		assertTrue(c.get("linux").contains("pg_join_test"));
		assertTrue(c.get("linux").contains("--version v2.3.3"));
		assertTrue(c.get("windowsGitBash").contains("export SERVER_ID=kali-01"));
		assertTrue(c.get("windowsPowerShell").contains("$env:SERVER_ID"));
		assertTrue(c.get("docker").contains("ghcr.io/sokmeankao/pulsegrid-agent:v2.3.3"));
		assertTrue(c.get("docker").contains("JOIN_TOKEN=pg_join_test"));
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && ./gradlew test --tests com.monitoring.backend.enrollment.AgentInstallCommandsTest`
Expected: FAIL (class not found)

- [ ] **Step 3: Implement `AgentInstallCommands`**

```java
package com.monitoring.backend.enrollment;

import java.util.LinkedHashMap;
import java.util.Map;

public final class AgentInstallCommands {
	private AgentInstallCommands() {}

	public static Map<String, String> build(
			String serverId,
			String monitorAddress,
			String token,
			String caUrl,
			String agentVersion) {
		String ver = (agentVersion == null || agentVersion.isBlank()) ? "v2.3.3" : agentVersion.trim();
		String linux = String.format(
				"sudo mkdir -p /etc/pulsegrid && sudo curl -fsSL %s -o /etc/pulsegrid/ca.crt && "
						+ "curl -fsSL https://raw.githubusercontent.com/SokmeanKao/Pulsegrid/main/scripts/install-agent.sh "
						+ "| sudo bash -s -- --server-id %s --monitor %s --token %s --ca /etc/pulsegrid/ca.crt --version %s",
				caUrl, serverId, monitorAddress, token, ver);
		String gitBash = String.format(
				"mkdir -p /c/pulsegrid && curl -fsSL %s -o /c/pulsegrid/ca.crt && "
						+ "curl -fL https://github.com/SokmeanKao/Pulsegrid/releases/download/%s/pulsegrid-agent-windows-amd64.exe "
						+ "-o /c/pulsegrid/pulsegrid-agent.exe && "
						+ "export SERVER_ID=%s MONITOR_ADDRESS=%s JOIN_TOKEN='%s' MONITOR_CA_FILE=/c/pulsegrid/ca.crt && "
						+ "/c/pulsegrid/pulsegrid-agent.exe",
				caUrl, ver, serverId, monitorAddress, token);
		String ps = String.format(
				"New-Item -ItemType Directory -Force -Path C:\\pulsegrid | Out-Null; "
						+ "Invoke-WebRequest -Uri %s -OutFile C:\\pulsegrid\\ca.crt; "
						+ "Invoke-WebRequest -Uri https://github.com/SokmeanKao/Pulsegrid/releases/download/%s/pulsegrid-agent-windows-amd64.exe "
						+ "-OutFile C:\\pulsegrid\\pulsegrid-agent.exe; "
						+ "$env:SERVER_ID='%s'; $env:MONITOR_ADDRESS='%s'; $env:JOIN_TOKEN='%s'; "
						+ "$env:MONITOR_CA_FILE='C:\\pulsegrid\\ca.crt'; C:\\pulsegrid\\pulsegrid-agent.exe",
				caUrl, ver, serverId, monitorAddress, token);
		String docker = String.format(
				"docker run -d --name pulsegrid-agent-%s "
						+ "-e SERVER_ID=%s -e MONITOR_ADDRESS=%s -e JOIN_TOKEN=%s "
						+ "-e MONITOR_CA_FILE=/certs/ca.crt "
						+ "-v ${PWD}/ca.crt:/certs/ca.crt:ro "
						+ "ghcr.io/sokmeankao/pulsegrid-agent:%s",
				serverId, serverId, monitorAddress, token, ver);
		Map<String, String> out = new LinkedHashMap<>();
		out.put("linux", linux);
		out.put("windowsGitBash", gitBash);
		out.put("windowsPowerShell", ps);
		out.put("docker", docker);
		return out;
	}

	public static String publicHttpBase(String advertiseHost, int httpPort) {
		String host = (advertiseHost == null || advertiseHost.isBlank()) ? "localhost" : advertiseHost.trim();
		int port = httpPort <= 0 ? 8080 : httpPort;
		if (port == 80) return "http://" + host;
		return "http://" + host + ":" + port;
	}
}
```

- [ ] **Step 4: Update `EnrollmentController`**

Inject `@Value("${GATEWAY_HTTP_PORT:8080}") int httpPort` and `@Value("${PULSEGRID_AGENT_VERSION:v2.3.3}") String agentVersion`.

In `enroll()`:

```java
String monitor = advertiseHost + ":" + gatewayPort;
String httpBase = AgentInstallCommands.publicHttpBase(advertiseHost, httpPort);
String caUrl = httpBase + "/api/agents/ca.crt";
String enrollUrl = httpBase + "/enroll/?s=" + urlEncode(created.serverId())
		+ "&t=" + urlEncode(created.token());
Map<String, String> commands = AgentInstallCommands.build(
		created.serverId(), monitor, created.token(), caUrl, agentVersion);

Map<String, Object> resp = new LinkedHashMap<>();
resp.put("serverId", created.serverId());
resp.put("token", created.token());
resp.put("expiresAt", created.expiresAt().toString());
resp.put("monitorAddress", monitor);
resp.put("caUrl", caUrl);
resp.put("enrollUrl", enrollUrl);
resp.put("commands", commands);
resp.put("installCommand", commands.get("linux"));
return ResponseEntity.ok(resp);
```

Use `URLEncoder.encode(s, StandardCharsets.UTF_8)` for query values.

- [ ] **Step 5: Run tests**

Run: `cd backend && ./gradlew test --tests com.monitoring.backend.enrollment.*`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/com/monitoring/backend/enrollment/AgentInstallCommands.java \
  backend/src/main/java/com/monitoring/backend/enrollment/EnrollmentController.java \
  backend/src/test/java/com/monitoring/backend/enrollment/AgentInstallCommandsTest.java
git commit -m "feat(backend): enrich agent enroll API with OS commands and enrollUrl"
```

---

### Task 2: Expose enroll fields on `/pulsegrid-config`

**Files:**
- Modify: `backend/src/main/java/com/monitoring/backend/web/PulsegridConfigController.java`
- Modify: `dashboard/lib/runtimeConfig.ts`

**Interfaces:**
- Produces config JSON keys: `advertiseHost`, `gatewayPort`, `httpPort`, `agentVersion` (strings/numbers)
- Produces TS type fields on `PulsegridRuntimeConfig`

- [ ] **Step 1: Extend Java controller**

```java
@Value("${GATEWAY_ADVERTISE_HOST:localhost}")
private String advertiseHost;
@Value("${GATEWAY_PORT:50051}")
private int gatewayPort;
@Value("${GATEWAY_HTTP_PORT:8080}")
private int httpPort;
@Value("${PULSEGRID_AGENT_VERSION:v2.3.3}")
private String agentVersion;

@GetMapping("/pulsegrid-config")
public ResponseEntity<Map<String, Object>> config() {
	Map<String, Object> body = new LinkedHashMap<>();
	body.put("sameOrigin", sameOrigin);
	body.put("apiUrl", apiUrl == null ? "" : apiUrl.trim());
	body.put("wsUrl", wsUrl == null ? "" : wsUrl.trim());
	body.put("backendPort", "");
	body.put("advertiseHost", advertiseHost == null ? "localhost" : advertiseHost.trim());
	body.put("gatewayPort", gatewayPort);
	body.put("httpPort", httpPort);
	body.put("agentVersion", agentVersion == null || agentVersion.isBlank() ? "v2.3.3" : agentVersion.trim());
	return ResponseEntity.ok(body);
}
```

- [ ] **Step 2: Extend `runtimeConfig.ts`**

Add to type and parser:

```ts
export type PulsegridRuntimeConfig = {
  apiUrl: string;
  wsUrl: string;
  backendPort: string;
  advertiseHost: string;
  gatewayPort: number;
  httpPort: number;
  agentVersion: string;
};
```

When parsing `/pulsegrid-config`, fill defaults: `advertiseHost` from `window.location.hostname`, `gatewayPort` 50051, `httpPort` from location or 8080, `agentVersion` `"v2.3.3"`.

- [ ] **Step 3: Smoke-check TypeScript**

Run: `cd dashboard && npx tsc --noEmit`
Expected: PASS (or only pre-existing errors unrelated to this change)

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/java/com/monitoring/backend/web/PulsegridConfigController.java \
  dashboard/lib/runtimeConfig.ts
git commit -m "feat: expose advertise host and agent version in pulsegrid-config"
```

---

### Task 3: Client command builder + shadcn QR / Tabs / Switch

**Files:**
- Create: `dashboard/lib/enrollmentCommands.ts`
- Create: `dashboard/lib/enrollmentCommands.test.ts` (or colocated test matching repo style)
- Create: `dashboard/components/ui/qr-code.tsx`
- Create: `dashboard/components/ui/tabs.tsx` (if not present — currently missing)
- Create: `dashboard/components/ui/switch.tsx` (if not present)
- Modify: `dashboard/package.json` (add `qrcode.react`)

**Interfaces:**
- Produces: `buildEnrollmentMaterials({ serverId, token, advertiseHost, gatewayPort, httpPort, agentVersion, apiUrl? }) → { monitorAddress, caUrl, enrollUrl, commands, installCommand }`
- Produces: `<QrCode value={string} size?: number className?: string />`

- [ ] **Step 1: Install dependency**

Run: `cd dashboard && npm install qrcode.react`

- [ ] **Step 2: Write failing test for client builder**

```ts
import { buildEnrollmentMaterials } from "./enrollmentCommands";

describe("buildEnrollmentMaterials", () => {
  it("builds urls and four command variants", () => {
    const m = buildEnrollmentMaterials({
      serverId: "win-01",
      token: "pg_join_x",
      advertiseHost: "192.168.0.230",
      gatewayPort: 50051,
      httpPort: 8080,
      agentVersion: "v2.3.3",
    });
    expect(m.caUrl).toBe("http://192.168.0.230:8080/api/agents/ca.crt");
    expect(m.enrollUrl).toContain("/enroll/?");
    expect(m.enrollUrl).toContain("s=win-01");
    expect(m.commands.linux).toContain("pg_join_x");
    expect(m.commands.windowsGitBash).toContain("SERVER_ID=win-01");
    expect(m.commands.windowsPowerShell).toContain("$env:SERVER_ID");
    expect(m.commands.docker).toContain("pulsegrid-agent:v2.3.3");
  });
});
```

- [ ] **Step 3: Implement `enrollmentCommands.ts`** mirroring backend strings (same templates as Task 1).

- [ ] **Step 4: Add `components/ui/qr-code.tsx`**

```tsx
"use client";

import { QRCodeSVG } from "qrcode.react";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  size?: number;
  className?: string;
  label?: string;
};

export function QrCode({ value, size = 160, className, label = "QR code" }: Props) {
  return (
    <div
      className={cn(
        "inline-flex items-center justify-center border border-[var(--t-border)] bg-white p-2",
        className,
      )}
      role="img"
      aria-label={label}
    >
      <QRCodeSVG value={value} size={size} level="M" includeMargin={false} />
    </div>
  );
}
```

- [ ] **Step 5: Add minimal shadcn-style `tabs.tsx` and `switch.tsx`** using Radix (`@radix-ui/react-tabs`, `@radix-ui/react-switch`) — install if missing — styled with `--t-*` vars to match the terminal UI (not default purple).

- [ ] **Step 6: Run dashboard tests / tsc**

Run: `cd dashboard && npm test -- --testPathPattern=enrollmentCommands` (or project’s jest/vitest command); `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add dashboard/package.json dashboard/package-lock.json \
  dashboard/lib/enrollmentCommands.ts dashboard/lib/enrollmentCommands.test.ts \
  dashboard/components/ui/qr-code.tsx dashboard/components/ui/tabs.tsx \
  dashboard/components/ui/switch.tsx
git commit -m "feat(dashboard): enrollment command builder and shadcn QR/tabs"
```

---

### Task 4: Shared `EnrollmentMaterials` + rewrite `AddAgentModal`

**Files:**
- Create: `dashboard/components/agents/EnrollmentMaterials.tsx`
- Modify: `dashboard/components/agents/AddAgentModal.tsx`

**Interfaces:**
- Consumes: enroll API result OR `buildEnrollmentMaterials` output shape
- Props: `{ serverId, token, expiresAt?, monitorAddress, caUrl, enrollUrl, commands, installCommand }`

- [ ] **Step 1: Implement `EnrollmentMaterials`**

Include:

- Masked token with Reveal + Copy
- Expiry / “treat like a password” warning
- Download CA (`<a href={caUrl} download="ca.crt">`)
- Tabs: Linux | Windows (Git Bash) | Windows (PowerShell) | Docker — each with short numbered steps + `<pre>` + Copy
- QR: `QrCode` with `value={encodeLinux ? commands.linux : enrollUrl}`
- Switch labeled “Encode Linux install command instead”

- [ ] **Step 2: Wire `AddAgentModal`**

On successful enroll, map API JSON into `EnrollmentMaterials`. Keep “Enroll another”. Remove single-command-only UI.

Type the fetch response:

```ts
type EnrollResponse = {
  serverId: string;
  token: string;
  expiresAt: string;
  monitorAddress: string;
  caUrl: string;
  enrollUrl: string;
  installCommand: string;
  commands: {
    linux: string;
    windowsGitBash: string;
    windowsPowerShell: string;
    docker: string;
  };
};
```

Fallback: if older API missing `commands`, build via `buildEnrollmentMaterials` using runtime config + token.

- [ ] **Step 3: Manual check in browser** (dev or static preview): open modal, generate, switch tabs, toggle QR.

- [ ] **Step 4: Commit**

```bash
git add dashboard/components/agents/EnrollmentMaterials.tsx \
  dashboard/components/agents/AddAgentModal.tsx
git commit -m "feat(dashboard): rich Add Agent modal with OS tabs and QR"
```

---

### Task 5: Static `/enroll/` landing page

**Files:**
- Create: `dashboard/app/enroll/page.tsx`
- Modify: `docs/INSTALL.md` (short “use + Add Agent / scan QR” note under Add Agent)

**Interfaces:**
- Reads `s`, `t` from `useSearchParams` (client component; wrap in suspense if Next requires)
- Uses `loadPulsegridConfig` + `buildEnrollmentMaterials` + `EnrollmentMaterials`

- [ ] **Step 1: Create page**

```tsx
"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { loadPulsegridConfig } from "@/lib/runtimeConfig";
import { buildEnrollmentMaterials } from "@/lib/enrollmentCommands";
import { EnrollmentMaterials } from "@/components/agents/EnrollmentMaterials";

function EnrollInner() {
  const params = useSearchParams();
  const serverId = (params.get("s") ?? "").trim();
  const token = (params.get("t") ?? "").trim();
  const [ready, setReady] = useState(false);
  const [materials, setMaterials] = useState<ReturnType<typeof buildEnrollmentMaterials> | null>(null);

  useEffect(() => {
    if (!serverId || !token) {
      setReady(true);
      return;
    }
    void loadPulsegridConfig().then((cfg) => {
      setMaterials(
        buildEnrollmentMaterials({
          serverId,
          token,
          advertiseHost: cfg.advertiseHost,
          gatewayPort: cfg.gatewayPort,
          httpPort: cfg.httpPort,
          agentVersion: cfg.agentVersion,
        }),
      );
      setReady(true);
    });
  }, [serverId, token]);

  if (!ready) return <p className="p-4 font-mono text-xs text-[var(--t-muted)]">Loading…</p>;
  if (!serverId || !token || !materials) {
    return (
      <div className="p-4 font-mono text-xs text-[var(--t-text)]">
        <p className="text-[var(--t-critical)]">Missing enroll parameters.</p>
        <Link href="/terminal/" className="text-[var(--t-info)] underline">
          Back to dashboard
        </Link>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-2xl p-4">
      <h1 className="mb-3 font-mono text-sm text-[var(--t-info)]">Pulsegrid — Enroll agent</h1>
      <EnrollmentMaterials {...materials} serverId={serverId} token={token} />
    </div>
  );
}

export default function EnrollPage() {
  return (
    <Suspense fallback={<p className="p-4 font-mono text-xs">Loading…</p>}>
      <EnrollInner />
    </Suspense>
  );
}
```

Adjust prop spread to match `EnrollmentMaterials` props exactly.

- [ ] **Step 2: Build static export**

Run: `cd dashboard && npm run build`
Expected: `/enroll/index.html` present in `out/`

- [ ] **Step 3: Update INSTALL.md** — under Add Agent, note UI **+ Add Agent** and QR `/enroll/?s=&t=`.

- [ ] **Step 4: Commit**

```bash
git add dashboard/app/enroll/page.tsx docs/INSTALL.md
git commit -m "feat(dashboard): static enroll landing page with QR materials"
```

---

### Task 6: Compose env + docs smoke + tag note

**Files:**
- Modify: `deploy/monitor/env.example` — add `GATEWAY_HTTP_PORT=8080`, `PULSEGRID_AGENT_VERSION=v2.3.3` if not passed through compose
- Modify: `docker-compose.monitor.yml` — pass `GATEWAY_HTTP_PORT` and `PULSEGRID_AGENT_VERSION` into monitor service env

- [ ] **Step 1: Wire compose env**

```yaml
GATEWAY_HTTP_PORT: ${HTTP_PORT:-8080}
PULSEGRID_AGENT_VERSION: ${PULSEGRID_AGENT_VERSION:-v2.3.3}
```

- [ ] **Step 2: Update `env.example`**

- [ ] **Step 3: Commit**

```bash
git add docker-compose.monitor.yml deploy/monitor/env.example
git commit -m "chore(monitor): pass HTTP port and agent version into enroll URLs"
```

---

## Spec coverage checklist

| Spec item | Task |
|---|---|
| Enriched enroll API + `installCommand` alias | 1 |
| `caUrl` / `enrollUrl` on advertise host:8080 | 1 |
| OS command variants | 1 + 3 |
| Runtime config for enroll page | 2 |
| shadcn-style QR + toggle | 3 + 4 |
| Modal tabs + steps + CA + token | 4 |
| Static `/enroll/` page | 5 |
| Secret warning | 4 (`EnrollmentMaterials`) |
| Compose/env for ports/version | 6 |

## Placeholder scan

No TBD/TODO steps; command templates are explicit in Task 1 and mirrored in Task 3.
