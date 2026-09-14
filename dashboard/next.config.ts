import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export for the unified monitor image. Avoid trailingSlash — with Next 16
  // RSC fetches it can 307-loop (/terminal/ ↔ /terminal/?_rsc) → ERR_TOO_MANY_REDIRECTS.
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
