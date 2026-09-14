import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Runtime config for published dashboard images.
 * Path is /pulsegrid-config (not /api/*) so nginx can send /api to the backend.
 *
 * Env:
 *   PULSEGRID_SAME_ORIGIN=1  → browser uses window.location (nginx single port)
 *   PULSEGRID_API_URL / PULSEGRID_WS_URL / PULSEGRID_BACKEND_PORT → explicit overrides
 */
export async function GET() {
  const sameOrigin =
    process.env.PULSEGRID_SAME_ORIGIN === "1" ||
    process.env.PULSEGRID_SAME_ORIGIN === "true";
  return NextResponse.json({
    sameOrigin,
    apiUrl: process.env.PULSEGRID_API_URL?.trim() || "",
    wsUrl: process.env.PULSEGRID_WS_URL?.trim() || "",
    backendPort: process.env.PULSEGRID_BACKEND_PORT?.trim() || "",
  });
}
