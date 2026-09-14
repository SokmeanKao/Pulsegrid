import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Runtime config for published dashboard images (URLs not baked at build time).
 * Set PULSEGRID_API_URL / PULSEGRID_WS_URL / PULSEGRID_BACKEND_PORT on the container.
 */
export async function GET() {
  return NextResponse.json({
    apiUrl: process.env.PULSEGRID_API_URL?.trim() || "",
    wsUrl: process.env.PULSEGRID_WS_URL?.trim() || "",
    backendPort: process.env.PULSEGRID_BACKEND_PORT?.trim() || "8080",
  });
}
