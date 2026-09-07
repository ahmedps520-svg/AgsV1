import type { NextConfig } from "next";

/**
 * Static export.
 *
 * The app is published to GitHub Pages, which serves files and nothing else —
 * so there is no Next.js server, no middleware and no server actions. All data
 * access happens in the browser against Supabase, where Row Level Security and
 * the SECURITY DEFINER workflow functions enforce exactly the same rules.
 *
 * `NEXT_PUBLIC_BASE_PATH` is set to `/AgsV1` by the deploy workflow because
 * project Pages sites are served from a repository sub-path.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  basePath: basePath || undefined,
  assetPrefix: basePath || undefined,
  // Pages serves /foo as /foo/index.html.
  trailingSlash: true,
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    // No image optimiser exists on a static host.
    unoptimized: true,
    remotePatterns: [{ protocol: "https", hostname: "**.supabase.co" }],
  },
};

export default nextConfig;
