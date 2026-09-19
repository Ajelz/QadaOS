import type { NextConfig } from "next";

/**
 * The service worker is built by `serwist build` (see serwist.config.ts) after
 * `next build`, so this config stays bundler-agnostic and works with Turbopack.
 */
const nextConfig: NextConfig = {
  reactCompiler: true,
  turbopack: {},
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
